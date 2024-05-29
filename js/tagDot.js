// import { _Math } from 'three/src/math/Math';
import utils from './utils';
import { SPHERE_RADIUS } from './constants';

export default class TagDot {
  constructor(dom, data) {
    this.dom = dom;
    this.data = data;
    this.dirAngle = { x: data.x, y: data.y };
    this.position = [-10000, -100000];
  }
  render(container) {
    this.setMesh();
    this.container = container;
    if (this.container && this.dom) {
      this.container.appendChild(this.dom);
    }
  }

  setDirAngle(x, y) {
    this.data.x = x;
    this.data.y = y;
    this.dirAngle = { x, y };
    this.setMesh();
  }
  setMesh() {
    const tagMesh = new THREE.Mesh();
    // 兼容原来的数据，让原来的导航在当前系统中也能显示到正确的位置上
    const position = utils.lglt2xyz(this.dirAngle.x, -this.dirAngle.y + Math.PI / 2, SPHERE_RADIUS);
    tagMesh.position.copy(position);
    this.position = position;
    this.tagMesh = tagMesh;
  }
  // 更新dot的位置
  updatePosition(camera) {
    // 判断是vr模式还是正常模式
    if (this.traveller && this.traveller.isGlassesMode()) {
      this.tagMesh.updateMatrixWorld();
      const leftEyePart = this.dom.querySelector('[eye=left]');
      if (leftEyePart) {
        if (utils.isOffScreen(this.tagMesh, camera.cameraL)) {
          leftEyePart.style.display = 'none';
        } else {
          leftEyePart.style.display = 'block';
          const position = utils.toScreenPosition(
            this.tagMesh,
            camera.cameraL,
            this.container,
            'left'
          );
          this.position = position;
          let rotateX = -(90 + THREE.MathUtils.radToDeg(camera.cameraL.rotation.x));
          rotateX = Math.max(-60, Math.min(rotateX, -30));
          leftEyePart.style.transform = `translate3d(${position[0]}px, ${position[1]}px, 0) rotateZ(0deg) rotateX(${rotateX}deg) scale(1)`;
          // 'translate3d(' +
          // position[0] +
          // 'px, ' +
          // position[1] +
          // 'px, 0) rotateZ(' +
          // 0 +
          // 'deg) ' +
          // 'rotateX(' +
          // rotateX +
          // 'deg) scale(' +
          // 1 +
          // ')'
        }
        // let position = this.projection_.angleToPixel(this.dirAngle_[0], this.dirAngle_[1], 'left');
        // this.transform(leftEyePart, position.left, position.top, rotateX, rotateZ, 'left');
      }

      const rightEyePart = this.dom.querySelector('[eye=right]');
      if (rightEyePart) {
        if (utils.isOffScreen(this.tagMesh, camera.cameraR)) {
          rightEyePart.style.display = 'none';
        } else {
          rightEyePart.style.display = 'block';
          const position = utils.toScreenPosition(
            this.tagMesh,
            camera.cameraR,
            this.container,
            'right'
          );
          let rotateX = -(90 + THREE.MathUtils.radToDeg(camera.cameraR.rotation.x));
          rotateX = Math.max(-60, Math.min(rotateX, -30));
          rightEyePart.style.transform = `translate3d(${position[0]}px, ${position[1]}px, 0) rotateZ(0deg) rotateX(${rotateX}deg) scale(1)`;
          // 'translate3d(' +
          // position[0] +
          // 'px, ' +
          // position[1] +
          // 'px, 0) rotateZ(' +
          // 0 +
          // 'deg) ' +
          // 'rotateX(' +
          // rotateX +
          // 'deg) scale(' +
          // 1 +
          // ')'
        }
        // let position = this.projection_.angleToPixel(this.dirAngle_[0], this.dirAngle_[1], 'right');
        // this.transform(rightEyePart, position.left, position.top, rotateX, rotateZ, 'right');
      }
    } else {
      // 不调用会影响初始判断在不在屏幕
      this.tagMesh.updateMatrixWorld();
      // 2d坐标没有z轴，所以相机旋转的时候前后都会有这个overlay，需要判断当前overlay是否在屏幕外
      if (utils.isOffScreen(this.tagMesh, camera)) {
        this.dom.style.display = 'none';
        // const position = toScreenPosition(this.tagMesh, camera, this.container);
        // this.dom.style.left = position[0] + "px";
        // this.dom.style.top = position[1] + "px";
      } else {
        this.dom.style.display = 'block';
        const position = utils.toScreenPosition(this.tagMesh, camera, this.container);
        this.position = position;
        // 向下看的时候导航指向z轴，向上看导航指向y轴
        this.dom.style.transform = `translate3d(${position[0]}px, ${position[1]}px, 0) scale(1)`;
        this.dom.setAttribute('data-x', position[0]);
        this.dom.setAttribute('data-y', position[1]);
        // this.dom.setAttribute('data-name', this.data.title)
        // this.dom.style.left = position[0] + "px";
        // this.dom.style.top = position[1] + "px";
      }
    }
  }
  // 将traveller对象传递过来
  setTraveller(traveller) {
    this.traveller = traveller;
  }
  dispose() {
    if (this.dom && this.dom.parentNode) {
      this.dom.parentNode.removeChild(this.dom);
    }
    if (this.tagMesh) {
      try {
        this.tagMesh.remove();
        this.tagMesh = null;
      } catch (error) {
        console.log('error: ', error);
      }
    }
  }
  // getPosition
  getPosition() {
    return this.position;
  }
}
