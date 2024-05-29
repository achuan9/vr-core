// import {Scene, AmbientLight, PerspectiveCamera, Quaternion, Raycaster, Vector2} from 'three';
// import { _Math } from 'three/src/math/Math';
import { DeviceOrientationControls } from '@/utils/vr/deviceOrientationControls';
import { StereoEffect } from '@/utils/vr/stereoEffect';

import utils from '../js/utils';
import CorrectRotation from '../js/correctRotation';
import ManulRotation from '../js/manulRotation';
import MouseController from '../js/mouseControl';
import GlPainter from '../js/glPainter';
import CubePainter from '../js/cubePainter';
import LineEditPainter from '../js/lineEditPainter';
import PolygonEditPainter from '../js/polygonEditPainter';
import { startTween } from '@/utils/methods';
import renderWithThreejs from '../js/renderWithThreejs';
import { useEmitt } from '@sutpc/portal/src/hooks';
const { emitter } = useEmitt();
// import StatsView from '../js/stats';

// const stats = new StatsView();

export default class VrViewer {
  constructor(el, { rotation, enableAnimation = true }) {
    this.animateStepArg = {
      // toRotation: [0, 0, 0],
      toRotation: rotation,
      fromRotation: [70, -90, 0]
    };
    this.enableAnimation = enableAnimation;
    // vr全景图的渲染dom
    this.container = el;
    // 记录当前场景的旋转角度
    this.correctRotation = new CorrectRotation(0, 0, 0);
    this.manulRotation = new ManulRotation(
      this.animateStepArg.fromRotation[0],
      this.animateStepArg.fromRotation[1],
      this.animateStepArg.fromRotation[2]
    );

    // 横轴锁定
    this.lockX = false;
    this.lockY = false;
    // overlays
    this.overlays = [];
    this.dots = [];

    this.hasInterval = true;

    this.init();
  }
  startInitAnimated() {
    const _this = this;
    startTween({
      from: this.animateStepArg.fromRotation,
      to: this.animateStepArg.toRotation,
      time: this.enableAnimation ? 1300 : 100,
      onUpdate(coords) {
        _this.setInitRotation({
          rotation: coords
        });
      }
    });
  }

  initScene() {
    // 添加场景
    this.scene = new THREE.Scene();

    // 添加光源
    const light = new THREE.AmbientLight(0xffffff);
    this.scene.add(light);
    // 设置相机
    const width = this.container.clientWidth,
      height = this.container.clientHeight,
      fov = 90;
    // 创建相机
    const camera = new THREE.PerspectiveCamera(fov, width / height, 1, 1000);
    // camera.position.z = 380
    // camera.position.set(0, 0, 260)
    // camera.lookAt(1, 1, 1)
    //
    this.camera = camera;
  }

  initRenderer() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    // 创建渲染器
    let renderer;
    if (this.webglSupported()) {
      this.painter = new GlPainter(this);
      renderer = this.painter.renderer;
      renderer.setClearColor(0xeeeeee, 1.0);
    } else {
      this.painter = new CubePainter(this);
      renderer = this.painter.renderer;
    }
    // renderer.setPixelRatio( window.devicePixelRatio );

    renderer.setSize(width, height);
    this.renderer = renderer;
    this.curRenderer = renderer;

    renderer.domElement.oncontextmenu = (e) => {
      e.preventDefault();
      return false;
    };
    // 渲染
    this.container.appendChild(renderer.domElement);
    this.canvas = renderer.domElement;

    // 覆盖一个同大小的canvas用于绘制
    const dom = document.createElement('canvas');
    dom.className = 'topCanvas';
    dom.width = width;
    dom.height = height;
    this.container.appendChild(dom);
    this.topCanvas = dom;
  }
  init() {
    this.initScene();
    this.initRenderer();
    this.startInitAnimated();
    // 初始化陀螺仪
    this.devices = new DeviceOrientationControls(this.camera);

    // 鼠标事件处理
    this.mouseControl = new MouseController(this);

    // 双屏效果
    this.VRRenderer = new StereoEffect(this.renderer);

    this.lineRenderer = new LineEditPainter(this);
    this.polygonRenderer = new PolygonEditPainter(this);

    this.renderWithThreejs = new renderWithThreejs(this);

    // const canvas = this.topCanvas
    // const ctx = canvas.getContext('2d')
    // const width = this.container.clientWidth
    // const height = this.container.clientHeight
    // ctx.fillStyle = 'black'
    // ctx.clearRect(0, 0, width, height)

    // ctx.strokeWidth = 5
    // ctx.strokeStyle = 'blue'
    // ctx.moveTo(100, 100)
    // ctx.lineTo(200, 200)
    // ctx.stroke()
  }
  dispose() {
    if (this.container) {
      // 解决多次初始化生成多个canvas对象
      while (this.container.hasChildNodes()) {
        this.container.removeChild(this.container.firstChild);
      }
    }
    if (this.painter && this.painter instanceof GlPainter) {
      this.painter.dispose();
    }
    this.lineRenderer?.dispose();
    this.polygonRenderer?.dispose();
  }

  resetMaterialOpacity() {
    return new Promise((resolve, reject) => {
      this.painter.updateMaterialOpacity(() => {
        resolve();
      });
    });
  }

  // 每次切换场景的时候要执行的操作
  resetScene(opt) {
    // 先设置相机角度，然后再贴图
    this.setInitRotation(opt);
    // // 先把之前的场景删除
    // this.painter.resetScene();
    // 相机视角恢复
    this.camera.fov = 90;
    this.camera.updateProjectionMatrix();
  }
  resetMouseArg(angleArg) {
    // 设置鼠标滚轮的最大值和最小值
    this.mouseControl.setMouseArg(angleArg);
  }

  async setScene(url, slices, opt, angleArg) {
    this.resetScene(opt);
    this.painter.loadThumb(url, async () => {
      await this.resetMaterialOpacity();
      this.resetMouseArg(angleArg);
      if (this.hasInterval) {
        this.render();
        this.hasInterval = false;
      } else {
        // 这里需要手动调用一次，这样才能先渲染场景，然后再渲染overlay
        // 切换场景的时候会导致先添加overlay，然后才会走到requestAnimationFrame，
        // 这时候使用的相机就是之前的相机，
        // 如果之前相机的初始角度和当前相机的初始角度不一致，就会导致overlay的计算结果不在视线范围内
        if (this.isDeviceing) {
          this.curRenderer.render(this.scene, this.camera, (camera) => {
            this.VRcamera = camera;
          });
        } else {
          this.curRenderer.render(this.scene, this.camera);
        }
      }
      opt && opt.cb && opt.cb();

      setTimeout(() => {
        this.painter.setSlices(slices, url);
      }, 1000);
    });
  }
  render() {
    // stats.update();

    if (this.isDeviceing) {
      this.devices.update();
    }
    if (this.painter.sphere) {
      this.painter.sphere.geometry.groupsNeedUpdate = true;
      this.painter.sphere.geometry.uvsNeedUpdate = true;
    }

    if (this.isDeviceing) {
      this.curRenderer.render(this.scene, this.camera, (camera) => {
        this.VRcamera = camera;
      });
    } else {
      this.curRenderer.render(this.scene, this.camera);
    }
    this.updatePosition();
    // this.painter.loadSlices();
    // var axis = new THREE.Vector3(0, 1, 0) //向量axis
    // this.camera.rotateOnAxis(axis, Math.PI / 120)
    this.topCanvas.height = this.topCanvas.height; // 清空画布
    this.lineRenderer && this.lineRenderer.render();
    this.polygonRenderer && this.polygonRenderer.render();

    requestAnimationFrame(this.render.bind(this));
  }
  // correctRotation的旋转角度
  setYawRotation(val) {
    this.correctRotation.setAlphaRotation(val);
    this.setRotation();
  }
  setRollRotation(val) {
    this.correctRotation.setGammaRotation(val);
    this.setRotation();
  }
  setPitchRotation(val) {
    this.correctRotation.setBetaRotation(Math.min(Math.max(val, -90), 90));
    this.setRotation();
  }
  // manulRotation的旋转角度
  setManulRotationX(val) {
    this.manulRotation.setBetaRotation(Math.min(Math.max(val, -90), 90));
    this.setRotation();
  }
  setManulRotationY(val) {
    this.manulRotation.setAlphaRotation(val);
    this.setRotation();
  }
  setRotation() {
    const quat = new THREE.Quaternion();
    const correction = this.correctRotation.getQuat();
    const manual = this.manulRotation.getQuat();
    quat.multiply(correction);
    quat.multiply(manual);
    this.camera.quaternion.copy(quat);
  }
  setManualRotationByCamera() {
    const quatCamera = this.camera.quaternion;
    const quatCorrect = this.correctRotation.getQuat();
    const invert = quatCorrect.inverse();
    const manual = invert.multiply(quatCamera);
    this.manulRotation.setFromQuaternion(manual);
  }
  // 设置初始朝向
  setInitRotation(opt) {
    if (opt.correction) {
      this.correctRotation.reset(opt.correction);
    }
    if (opt.rotation) {
      this.manulRotation.reset(opt.rotation);
    }
    this.setRotation();
  }

  // /**
  //  * @description 删除指定名称的overlay
  //  * @param {any} uid 要删除的overlay 的uid
  //  * @memberof VrViewer
  //  */
  // delOneOverlay(uid) {
  //   this.overlays = this.overlays.filter((item) => {
  //     if (item.data.uid === uid) {
  //       item.dispose()
  //     }
  //     return item.data.uid !== uid
  //   })
  // }

  /**
   * @description 将平面左边转换成经纬度
   * @param {any} x 鼠标x坐标
   * @param {any} y 鼠标y坐标
   * @returns {lg: 经度, lt: 纬度}
   * @memberof VrViewer
   */
  pixelToAngle(x, y) {
    // 1.将2d坐标转换成3d坐标
    const raycaster = new THREE.Raycaster();
    const mouseVector = new THREE.Vector2();
    // 把鼠标坐标转换成webgl的3d坐标，webgl的原点在中心，鼠标坐标的原点在左上角
    if (typeof x !== 'undefined' && typeof y !== 'undefined') {
      mouseVector.x = 2 * (x / this.container.clientWidth) - 1;
      mouseVector.y = -2 * (y / this.container.clientHeight) + 1;
    } else {
      // 如果没有传x,y默认渲染在页面中心位置
      mouseVector.x = 0;
      mouseVector.y = 0;
    }
    raycaster.setFromCamera(mouseVector, this.camera);
    const intersects = raycaster.intersectObjects([this.painter.sphere]);
    if (intersects.length > 0) {
      const { point } = intersects[0];
      const theta = Math.atan2(point.x, -1.0 * point.z);
      const phi = Math.atan2(point.y, Math.sqrt(point.x * point.x + point.z * point.z));
      // 这里的3pi/2,是通过测试log推测出来的
      return { lg: (theta + (3 * Math.PI) / 2) % (Math.PI * 2), lt: phi };
    }
    return { lg: 0, lt: 0 };
  }
  // 添加overlay
  addOverlay(overlay, notAppend) {
    this.overlays.push(overlay);
    overlay.render(this.container);
    if (this.isDeviceing) {
      overlay.updatePosition(this.VRcamera);
    } else {
      overlay.updatePosition(this.camera);
    }
  }

  // 场景切换的时候先清空overlay
  clearOverlay() {
    this.overlays.forEach((overlay) => {
      overlay.dispose();
    });
    this.overlays = [];
  }
  // 旋转场景的时候让overlay跟着旋转
  // 如果是vr模式，当转到某一个导航上，需要聚焦，然后跳转到对应的场景上
  updateOverlayPos() {
    if (this.traveller && this.traveller.glassesButton) {
      this.traveller.glassesButton.setCurrentOverlay(null);
    }
    this.currentOverlay = null;
    this.overlays.forEach((item) => {
      if (this.isDeviceing) {
        item.updatePosition(this.VRcamera);
        const position = item.getPosition();
        const { focuserL, focuserW, focuserT, focuserH } = this.traveller.glassesButton.getFocus();
        // const focuserL = 162, focuserW = 50, focuserT = 141, focuserH = 50;
        if (
          position[0] > focuserL &&
          position[0] < focuserL + focuserW &&
          position[1] > focuserT &&
          position[1] < focuserT + focuserH
        ) {
          this.traveller.glassesButton.setCurrentOverlay(item);
          this.traveller.glassesButton.startCountMode();
        }
      } else {
        item.updatePosition(this.camera);
      }
    });
  }

  // 添加dot
  addDot(dot) {
    this.dots.push(dot);
    this.renderDot(dot);
  }

  renderDot(dot) {
    dot.render(this.container);
    if (this.isDeviceing) {
      dot.updatePosition(this.VRcamera);
    } else {
      dot.updatePosition(this.camera);
    }
  }

  clearDots() {
    this.dots.forEach((dot) => {
      dot.dispose();
    });
    this.dots = [];
  }

  selectDotById(id) {
    const dot = this.dots.find((x) => x.data.id === id);
    if (dot) {
      // this.handleMouseMove(dot.dirAngle.x, dot.dirAngle.y)
      // const { position } = dot.tagMesh
      // this.viewer.camera?.lookAt(position.x, position.y, position.z)
      // this.viewer.setManualRotationByCamera()
      this.turnCameraToDot(dot);
      this.updatePosition();
    }
  }

  turnCameraToDot(dot) {
    if (!dot) return;
    const _this = this;
    startTween({
      from: [this.manulRotation.alpha, this.manulRotation.beta, this.manulRotation.gamma],
      to: [THREE.MathUtils.radToDeg(dot.dirAngle.x), THREE.MathUtils.radToDeg(dot.dirAngle.y), 0],
      time: 600,
      onUpdate(coords) {
        _this.setInitRotation({ rotation: coords });
      }
    });
  }

  updateDotPos() {
    this.dots.forEach((item) => {
      if (!this.isDeviceing) {
        item.updatePosition(this.camera);
      }
    });
  }

  updatePosition() {
    this.updateOverlayPos();
    this.updateDotPos();
    this.lineRenderer?.updatePosition();
    this.polygonRenderer?.updatePosition();
  }

  getContainer() {
    return this.container;
  }
  getSize() {
    return {
      width: this.container.clientWidth,
      height: this.container.clientHeight
    };
  }

  // 开启VR模式
  enableVRMode() {
    this.isDeviceing = true;
    this.devices.connect();
    this.setVR(true);
  }

  // 关闭VR模式
  disableVRMode() {
    this.isDeviceing = false;
    this.devices.disconnect();
    this.setVR(false);
  }
  // 开启、关闭双屏
  setVR(bool) {
    if (bool) {
      this.curRenderer = this.VRRenderer;
    } else {
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
      this.curRenderer = this.renderer;
    }
  }
  getOverlays() {
    return this.overlays || [];
  }
  getTagDots() {
    return this.dots || [];
  }
  // 将traveller对象传递过来
  setTraveller(traveller) {
    this.traveller = traveller;
  }

  webglSupported() {
    return true;

    // try {
    //   const canvas = document.createElement('canvas')
    //   return !!(
    //     window.WebGLRenderingContext &&
    //     (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    //   )
    // } catch (e) {
    //   return false
    // }
  }

  setScale() {
    const { fov } = this.mouseControl;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
    this.painter.loadSlices();
    this.updatePosition();
  }
  getManulRotation() {
    return this.manulRotation.getRotation().slice(0);
  }
  getCorrectRotation() {
    return this.correctRotation.getRotation().slice(0);
  }
  getCameraCurrentFov() {
    return this.camera.fov;
  }
  // 设置水平方向被锁定
  setXLock(lock) {
    this.lockX = lock;
  }
  // 设置竖直方向被锁定
  setYLock(lock) {
    this.lockY = lock;
  }
  handleMouseMove(curX, curY) {
    if (!this.lockY) {
      this.setManulRotationX(curY);
    }
    if (!this.lockX) {
      this.setManulRotationY(curX);
    }
    this.updatePosition();
    emitter.emit('ON_MOUSE_MOVE', this.getManulRotation());
  }
  handleMouseUp() {
    // this.setSlices();
    this.painter.loadSlices();
  }
  handleWindowResize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.curRenderer.setSize(width, height);
  }
}
