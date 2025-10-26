import {
	Matrix4,
	Mesh,
	PerspectiveCamera,
	Plane,
	Vector3,
	Vector4,
	WebGLRenderTarget,
	HalfFloatType,
	NoToneMapping,
	MeshPhysicalMaterial,
	BufferGeometry,
	Camera,
	Scene,
	WebGLRenderer,
	Texture
} from 'three';

interface ReflectorOptions {
	textureWidth?: number;
	textureHeight?: number;
	clipBias?: number;
	multisample?: number;
	texture?: Texture;
}

class Reflector extends Mesh {
	isReflector: boolean;
	type: string;
	camera: PerspectiveCamera;
	getRenderTarget: () => WebGLRenderTarget;
	dispose: () => void;

	constructor( geometry: BufferGeometry, options: ReflectorOptions = {} ) {

		super( geometry );

		this.isReflector = true;

		this.type = 'Reflector';
		this.camera = new PerspectiveCamera();

		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const scope = this;
		const textureWidth = options.textureWidth || 512;
		const textureHeight = options.textureHeight || 512;
		const clipBias = options.clipBias || 0;
		const multisample = ( options.multisample !== undefined ) ? options.multisample : 4;
		const blendTexture = options.texture || undefined;

		//

		const reflectorPlane = new Plane();
		const normal = new Vector3();
		const reflectorWorldPosition = new Vector3();
		const cameraWorldPosition = new Vector3();
		const rotationMatrix = new Matrix4();
		const lookAtPosition = new Vector3( 0, 0, - 1 );
		const clipPlane = new Vector4();

		const view = new Vector3();
		const target = new Vector3();
		const q = new Vector4();

		const textureMatrix = new Matrix4();
		const virtualCamera = this.camera;

		const renderTarget = new WebGLRenderTarget( textureWidth, textureHeight, { samples: multisample, type: HalfFloatType } );

		this.material = new MeshPhysicalMaterial( { map: blendTexture });
		// @ts-expect-error - Adding custom uniforms to material
		this.material.uniforms = { tDiffuse     : { value: renderTarget.texture },
								   textureMatrix: { value: textureMatrix        }};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.material.onBeforeCompile = ( shader: any ) => {

			// Vertex Shader: Set Vertex Positions to the Unwrapped UV Positions
            let bodyStart	= shader.vertexShader.indexOf( 'void main() {' );
			shader.vertexShader =
                shader.vertexShader.slice(0, bodyStart) +
                '\nuniform mat4 textureMatrix;\nvarying vec4 vUv3;\n' +
				shader.vertexShader.slice( bodyStart - 1, - 1 ) +
				'	vUv3 = textureMatrix * vec4( position, 1.0 ); }';

			// Fragment Shader: Blend reflection with base texture (checkered floor)
			// Mix ratio: 0.75 = 75% base texture (checkered), 25% reflection
			bodyStart	= shader.fragmentShader.indexOf( 'void main() {' );
			shader.fragmentShader =
				//'#define USE_UV\n' +
                '\nuniform sampler2D tDiffuse; \n varying vec4 vUv3;\n' +
				shader.fragmentShader.slice( 0, bodyStart ) +
				shader.fragmentShader.slice( bodyStart - 1, - 1 ) +
					`	gl_FragColor = vec4( mix( texture2DProj( tDiffuse,  vUv3 ).rgb, gl_FragColor.rgb , 0.75), 1.0 );
				}`;

			// Set the LightMap Accumulation Buffer
			shader.uniforms.tDiffuse = { value: renderTarget.texture };
			shader.uniforms.textureMatrix = { value: textureMatrix };
			// @ts-expect-error - Custom uniforms
			this.material.uniforms = shader.uniforms;

			// Set the new Shader to this
			// @ts-expect-error - Material is always a single MeshPhysicalMaterial
			this.material.userData.shader = shader;
        };
        this.receiveShadow = true;


		this.onBeforeRender = function ( renderer: WebGLRenderer, scene: Scene, camera: Camera ) {

			reflectorWorldPosition.setFromMatrixPosition( scope.matrixWorld );
			cameraWorldPosition.setFromMatrixPosition( camera.matrixWorld );

			rotationMatrix.extractRotation( scope.matrixWorld );

			normal.set( 0, 0, 1 );
			normal.applyMatrix4( rotationMatrix );

			view.subVectors( reflectorWorldPosition, cameraWorldPosition );

			// Avoid rendering when reflector is facing away

			if ( view.dot( normal ) > 0 ) return;

			view.reflect( normal ).negate();
			view.add( reflectorWorldPosition );

			rotationMatrix.extractRotation( camera.matrixWorld );

			lookAtPosition.set( 0, 0, - 1 );
			lookAtPosition.applyMatrix4( rotationMatrix );
			lookAtPosition.add( cameraWorldPosition );

			target.subVectors( reflectorWorldPosition, lookAtPosition );
			target.reflect( normal ).negate();
			target.add( reflectorWorldPosition );

			virtualCamera.position.copy( view );
			virtualCamera.up.set( 0, 1, 0 );
			virtualCamera.up.applyMatrix4( rotationMatrix );
			virtualCamera.up.reflect( normal );
			virtualCamera.lookAt( target );

			if ('far' in camera) {
				virtualCamera.far = (camera as PerspectiveCamera).far; // Used in WebGLBackground
			}

			virtualCamera.updateMatrixWorld();
			virtualCamera.projectionMatrix.copy( camera.projectionMatrix );

			// Update the texture matrix
			textureMatrix.set(
				0.5, 0.0, 0.0, 0.5,
				0.0, 0.5, 0.0, 0.5,
				0.0, 0.0, 0.5, 0.5,
				0.0, 0.0, 0.0, 1.0
			);
			textureMatrix.multiply( virtualCamera.projectionMatrix );
			textureMatrix.multiply( virtualCamera.matrixWorldInverse );
			textureMatrix.multiply( scope.matrixWorld );

			// Now update projection matrix with new clip plane, implementing code from: http://www.terathon.com/code/oblique.html
			// Paper explaining this technique: http://www.terathon.com/lengyel/Lengyel-Oblique.pdf
			reflectorPlane.setFromNormalAndCoplanarPoint( normal, reflectorWorldPosition );
			reflectorPlane.applyMatrix4( virtualCamera.matrixWorldInverse );

			clipPlane.set( reflectorPlane.normal.x, reflectorPlane.normal.y, reflectorPlane.normal.z, reflectorPlane.constant );

			const projectionMatrix = virtualCamera.projectionMatrix;

			q.x = ( Math.sign( clipPlane.x ) + projectionMatrix.elements[ 8 ] ) / projectionMatrix.elements[ 0 ];
			q.y = ( Math.sign( clipPlane.y ) + projectionMatrix.elements[ 9 ] ) / projectionMatrix.elements[ 5 ];
			q.z = - 1.0;
			q.w = ( 1.0 + projectionMatrix.elements[ 10 ] ) / projectionMatrix.elements[ 14 ];

			// Calculate the scaled plane vector
			clipPlane.multiplyScalar( 2.0 / clipPlane.dot( q ) );

			// Replacing the third row of the projection matrix
			projectionMatrix.elements[ 2 ] = clipPlane.x;
			projectionMatrix.elements[ 6 ] = clipPlane.y;
			projectionMatrix.elements[ 10 ] = clipPlane.z + 1.0 - clipBias;
			projectionMatrix.elements[ 14 ] = clipPlane.w;

			// Render
			scope.visible = false;

			const currentRenderTarget = renderer.getRenderTarget();

			const currentXrEnabled = renderer.xr.enabled;
			const currentShadowAutoUpdate = renderer.shadowMap.autoUpdate;
			const currentToneMapping = renderer.toneMapping;

			renderer.xr.enabled = false; // Avoid camera modification
			renderer.shadowMap.autoUpdate = false; // Avoid re-computing shadows
			renderer.toneMapping = NoToneMapping;

			renderer.setRenderTarget( renderTarget );

			renderer.state.buffers.depth.setMask( true ); // make sure the depth buffer is writable so it can be properly cleared, see #18897

			if ( renderer.autoClear === false ) renderer.clear();
			renderer.render( scene, virtualCamera );

			renderer.xr.enabled = currentXrEnabled;
			renderer.shadowMap.autoUpdate = currentShadowAutoUpdate;
			renderer.toneMapping = currentToneMapping;

			renderer.setRenderTarget( currentRenderTarget );

			// Restore viewport

			const viewport = camera.viewport;

			if ( viewport !== undefined ) {

				renderer.state.viewport( viewport );

			}

			scope.visible = true;

		};

		this.getRenderTarget = function (): WebGLRenderTarget {
			return renderTarget;
		};

		this.dispose = function (): void {
			renderTarget.dispose();
			if (Array.isArray(scope.material)) {
				scope.material.forEach(m => m.dispose());
			} else {
				scope.material.dispose();
			}
		};

	}

}

export { Reflector };
