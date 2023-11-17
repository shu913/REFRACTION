import * as THREE from 'three';
import { vertexShader } from "./shader/vertex.glsl";
import { fragmentShader } from "./shader/fragment.glsl";

window.addEventListener("DOMContentLoaded", () => {
  const app = new App();

  app.load().then(() => {
    app.setup();
    app.setupObjects();
    app.render();
  });
});

class App {
  constructor() {
    this.texture;

    window.addEventListener('pointermove', (e) => {
      const { pageX, pageY } = e;
      // マウス座標とuv座標を揃える
      // 左下 0,0
      // 右上 1,1
      const x = pageX / window.innerWidth;
      const y = (pageY * -1) / window.innerHeight + 1.0;
      this.material.uniforms.u_mouse.value.x = x;
      this.material.uniforms.u_mouse.value.y = y;
    });
  }

  load() {
    return new Promise((resolve) => {
      const imgPath = "./img/img-6.jpg";
      const loader = new THREE.TextureLoader();
      loader.load(imgPath, (texture) => {
        this.texture = texture;
        resolve();
      });
    });
  }

  setup() {
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('app').appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000.0,
    );
    this.camera.position.z += 5.0;
  }

  setupObjects() {
    const geometry = new THREE.PlaneGeometry(1.0, 1.0);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        u_tex: { value: this.texture },
        resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        imageResolution: { value: new THREE.Vector2(16, 9) },
        u_mouse: { value: new THREE.Vector2(0, 0) },
      },
      vertexShader,
      fragmentShader,
    });
    const plane = new THREE.Mesh(geometry, this.material);

    const { screenWidth, screenHeight } = this.calcPlanePos();
    plane.scale.set(screenWidth, screenHeight, 1.0);

    this.scene.add(plane);
  }

  calcPlanePos() {
    const fovAtRadian = (this.camera.fov / 2) * (Math.PI / 180);
    const screenHeight = this.camera.position.z * Math.tan(fovAtRadian) * 2;
    const screenWidth = screenHeight * (window.innerWidth / window.innerHeight);

    return {
      screenWidth,
      screenHeight,
    };
  }

  render() {
    requestAnimationFrame(this.render.bind(this));

    this.renderer.render(this.scene, this.camera);
  }
}
