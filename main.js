import * as THREE from 'three';

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
      const imgPath = "img-6.jpg";
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
        resolution: {
          value: new THREE.Vector2(window.innerWidth, window.innerHeight),
        },
        imageResolution: { value: new THREE.Vector2(16, 9) },
        u_mouse: { value: new THREE.Vector2(0, 0) },
      },
      vertexShader: `
        varying vec2 vUv;

        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D u_tex;
        uniform vec2 resolution; // 画面のビューポート
        uniform vec2 imageResolution; // 画像のビューポート
        uniform vec2 u_mouse;

        // 最小から最大の範囲を変更する関数
        float map(float value, float min1, float max1, float min2, float max2) {
          float v = clamp(value, min1, max1);
          return min2 + (v - min1) * (max2 - min2) / (max1 - min1);
        }

        const float radius = 0.3;

        // ノイズ関数
        vec2 fade(vec2 t) {return t*t*t*(t*(t*6.0-15.0)+10.0);}
        vec4 permute(vec4 x) {return mod(((x*34.0)+1.0)*x, 289.0);}
        float cnoise(vec2 P){
          vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
          vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
          Pi = mod(Pi, 289.0); // To avoid truncation effects in permutation
          vec4 ix = Pi.xzxz;
          vec4 iy = Pi.yyww;
          vec4 fx = Pf.xzxz;
          vec4 fy = Pf.yyww;
          vec4 i = permute(permute(ix) + iy);
          vec4 gx = 2.0 * fract(i * 0.0243902439) - 1.0; // 1/41 = 0.024...
          vec4 gy = abs(gx) - 0.5;
          vec4 tx = floor(gx + 0.5);
          gx = gx - tx;
          vec2 g00 = vec2(gx.x,gy.x);
          vec2 g10 = vec2(gx.y,gy.y);
          vec2 g01 = vec2(gx.z,gy.z);
          vec2 g11 = vec2(gx.w,gy.w);
          vec4 norm = 1.79284291400159 - 0.85373472095314 * vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11));
          g00 *= norm.x;
          g01 *= norm.y;
          g10 *= norm.z;
          g11 *= norm.w;
          float n00 = dot(g00, vec2(fx.x, fy.x));
          float n10 = dot(g10, vec2(fx.y, fy.y));
          float n01 = dot(g01, vec2(fx.z, fy.z));
          float n11 = dot(g11, vec2(fx.w, fy.w));
          vec2 fade_xy = fade(Pf.xy);
          vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
          float n_xy = mix(n_x.x, n_x.y, fade_xy.y);
          return 2.3 * n_xy;
        }

        void main() {
          // background-size: coverにする
          vec2 ratio = vec2(
            min((resolution.x / resolution.y) / (imageResolution.x / imageResolution.y), 1.0),
            min((resolution.y / resolution.x) / (imageResolution.y / imageResolution.x), 1.0)
          );
          vec2 uv = vec2(
            vUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
            vUv.y * ratio.y + (1.0 - ratio.y) * 0.5
          );

          float n = cnoise(uv * 3.0) * 0.02;

          float dist = distance(vUv, u_mouse) + n;
          float limit = 1.0 - smoothstep(radius - 0.003, radius, dist);

          float range = map(dist, 0.1, radius, 0.0, 1.0);
          range = pow(range, 3.0);

          vec2 refract = (uv - u_mouse) * range;

          float inCircle_r = texture2D(u_tex, uv - refract).r;
          float inCircle_g = texture2D(u_tex, uv - refract).g;
          float inCircle_b = texture2D(u_tex, uv - refract).b;
          vec3 inCircle = vec3(inCircle_r, inCircle_g, inCircle_b);

          // 影
          float shadow = smoothstep(radius, radius + 0.1, dist);
          shadow = shadow * (1.0 - 0.5) + 0.5; // 0.0~1.0 を 0.9~1.0の範囲にする

          vec4 tex = texture2D(u_tex, vUv);
          vec3 color = mix(vec3(0.0), tex.rgb, shadow);
          color = mix(color, inCircle, limit);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
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
