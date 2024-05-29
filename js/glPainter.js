// import { WebGLRenderer, TextureLoader, SphereGeometry, MeshBasicMaterial,
// Mesh, LinearFilter, RGBFormat } from 'three';
// import { WebGLRenderer } from 'three/src/renderers/WebGLRenderer'
// import { TextureLoader } from 'three/src/loaders/TextureLoader'
// import { SphereGeometry } from 'three/src/geometries/SphereGeometry'
// import { MeshBasicMaterial } from 'three/src/materials/MeshBasicMaterial'
// import { Mesh } from 'three/src/objects/Mesh'
// import { LinearFilter, RGBFormat } from 'three/src/constants';
import { SPHERE_RADIUS } from './constants';
import TWEEN from '@tweenjs/tween.js';
import utils from './utils';
import { startTween } from '@/utils/methods';
// let testI = 0

export default class GlPainter {
  sceneUrl;
  opacity = 0.3;

  constructor(viewer) {
    this.viewer = viewer;
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      preserveDrawingBuffer: true // 保留图形缓冲区
    });
  }

  // 加载缩略图
  loadThumb(url, cb) {
    this.sceneUrl = url; //以URL作为key来标识当前的scene
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = '*';
    loader.load(url, (texture) => {
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      const widthSegments = 64,
        heightSegments = 64;

      const geometry = new THREE.SphereGeometry(SPHERE_RADIUS, widthSegments, heightSegments),
        materials = [
          new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.5 })
        ];

      geometry.scale(-1, 1, 1);
      const sphere = new THREE.Mesh(geometry, materials);

      if (this.lastSphere) {
        //如果有上一球, 移除
        this.removeSpere(this.lastSphere);
        this.disposeSpere(this.lastSphere);
      }
      this.lastSphere = this.sphere; //将当前球赋给上一球
      this.sphere = sphere; // 设置当前球
      this.widthSegments = widthSegments;
      this.widthScale = widthSegments / 8;
      this.heightSegments = heightSegments;
      this.heightScale = heightSegments / 4;
      this.viewer.scene.add(sphere);
      cb();
    });
  }
  // 加载清晰图
  loadSlices(urls, sceneUrl) {
    if (this.sceneUrl !== sceneUrl) return;
    if (this.complate) return;
    // const urls = this.slices;
    const camera = this.viewer.camera;
    if (!urls) return;
    const row = urls.length;
    const col = urls[0].length;
    // 渲染
    for (let i = 0; i < row; i++) {
      for (let j = 0; j < col; j++) {
        const index = i * col + j + 1;
        if (!this.sliceMap[`${i}-${j}`]) {
          // const isInSight = utils.isInSight(i, j, camera);
          // if (isInSight) {
          this.drawSlice(index, urls[i][j], sceneUrl);
          this.sliceMap[`${i}-${j}`] = 1;
          this.complate = this.checkComplate();
          // }
        }
      }
    }
  }
  // 设置清晰图资源
  setSlices(slices, sceneUrl) {
    // this.slices = slices;
    this.sliceMap = {};
    this.complate = false;
    this.loadSlices(slices, sceneUrl);
  }
  // 判断是否所有的清晰图都加载完成
  checkComplate() {
    return Object.keys(this.sliceMap).length === 32;
  }
  // 设置材料数组
  drawSlice(index, url, sceneUrl) {
    const loader = new THREE.TextureLoader();
    loader.format = THREE.RGBAFormat;
    loader.crossOrigin = '*';
    // 使用全景图片生成纹理
    loader.load(url, (texture) => {
      if (this.sceneUrl !== sceneUrl) {
        texture.dispose();
        return;
      }
      // 这里可以让纹理之间的过渡更加自然，不会出现明显的棱角
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      // debugger
      this.sphere.material[index] = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: this.opacity
      });
      this.updateSliceView(index);
    });
  }

  // 更新材质的透明度
  updateMaterialOpacity(onComplete) {
    const _this = this;
    if (this.lastSphere && this.lastSphere.material) {
      startTween({
        from: { opacity: 1 },
        to: { opacity: 0.3 },
        time: 1000,
        easing: TWEEN.Easing.Quadratic.Out,
        onUpdate(coords) {
          _this.lastSphere.material.forEach((item) => {
            item.opacity = coords.opacity;
          });
        },
        onComplete() {
          _this.viewer.scene.remove(_this.lastSphere);
        }
      });
    }
    if (this.sphere && this.sphere.material) {
      startTween({
        from: { opacity: 0.3 },
        to: { opacity: 1 },
        time: 1000,
        easing: TWEEN.Easing.Quadratic.Out,
        onUpdate(coords) {
          _this.opacity = coords.opacity;
          _this.sphere.material.forEach((item) => {
            item.opacity = coords.opacity;
          });
        },
        onComplete() {
          onComplete();
        }
      });
    } else {
      onComplete();
    }
  }
  // 更新三角面uv映射
  updateSliceView(index) {
    let sliceIndex = 0;
    const { widthSegments, heightSegments, widthScale, heightScale } = this;
    for (let i = 0, l = this.sphere.geometry.faces.length; i < l; i++) {
      // 每一个三角面对应的图片索引
      const imgIndex = utils.transIndex(i, widthSegments, heightSegments, widthScale, heightScale);
      if (imgIndex === index) {
        sliceIndex++;
        const uvs = utils.getVertexUvs(sliceIndex, widthScale, heightScale);
        if (i >= widthSegments * 2 * heightSegments - 3 * widthSegments || i < widthSegments) {
          this.sphere.geometry.faces[i].materialIndex = index;
          this.sphere.geometry.faceVertexUvs[0][i][0].set(...uvs[0].a);
          this.sphere.geometry.faceVertexUvs[0][i][1].set(...uvs[0].b);
          this.sphere.geometry.faceVertexUvs[0][i][2].set(...uvs[0].c);
        } else {
          this.sphere.geometry.faces[i].materialIndex = index;
          this.sphere.geometry.faces[i + 1].materialIndex = index;
          this.sphere.geometry.faceVertexUvs[0][i][0].set(...uvs[0].a);
          this.sphere.geometry.faceVertexUvs[0][i][1].set(...uvs[0].b);
          this.sphere.geometry.faceVertexUvs[0][i][2].set(...uvs[0].c);
          this.sphere.geometry.faceVertexUvs[0][i + 1][0].set(...uvs[1].a);
          this.sphere.geometry.faceVertexUvs[0][i + 1][1].set(...uvs[1].b);
          this.sphere.geometry.faceVertexUvs[0][i + 1][2].set(...uvs[1].c);
          i++;
        }
      }
    }
  }

  removeSpere(spere) {
    if (spere) {
      this.viewer.scene.remove(spere);
    }
  }
  disposeSpere(sphere) {
    const mat = sphere.material || [];
    mat.forEach((material) => {
      material.dispose();
    });
    sphere.geometry?.dispose();
  }
  dispose() {
    if (this.sphere) {
      this.disposeSpere(this.sphere);
    }
    if (this.lastSphere) {
      this.disposeSpere(this.lastSphere);
    }
  }
}
