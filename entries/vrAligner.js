import VrViewer from './vrView.js';
import Overlay from '../js/overlay.js';
import TagDot from '../js/tagDot.js';
import _ from 'lodash-es';
import { useEmitt } from '@sutpc/portal/src/hooks';
import { getByteLen } from '@/utils/methods';
import { base64ToStr } from '@/utils/base64';
const { emitter } = useEmitt();

export default class VrAligner {
  constructor(data, container) {
    this.uniqueId = 1;
    this.naviData = data;
    this.getCurScene();
    this.viewer = new VrViewer(container, {
      rotation: this.curScene?.scene?.rotation // 初始化动画
    });
    this.viewer.lineRenderer.setActive(true);
    this.viewer.polygonRenderer.setActive(true);

    this.mouse = {
      mouseDownX: 0,
      mouseDownY: 0,
      initX: 0,
      initY: 0
    };
    this.handleOverlayMouseDown = this.handleOverlayMouseDown.bind(this);
    this.handleOverlayMouseMove = this.handleOverlayMouseMove.bind(this);
    this.handleOverlayMouseUp = this.handleOverlayMouseUp.bind(this);
    this.handleDotMouseDown = this.handleDotMouseDown.bind(this);
    this.handleDotMouseMove = this.handleDotMouseMove.bind(this);
    this.handleDotMouseUp = this.handleDotMouseUp.bind(this);
    this.handleCanvasClick = this.handleCanvasClick.bind(this);
    this.toggleTooltip = this.toggleTooltip.bind(this);
    this.init();
  }
  init() {
    this.getCurScene();
    this.setScene();
  }
  dispose() {
    this.viewer && this.viewer.dispose();
  }
  setData(data, shouldInit = true) {
    this.naviData = data;
    if (shouldInit) {
      this.init();
    } else {
      this.curScene = this.naviData[this.curSceneIndex];
    }
    this.updateAll();
  }
  // 更新data 不执行重绘viewer操作
  updateData(data) {
    this.naviData = data;
    this.updateAll();
  }
  getCurScene() {
    const index = this.naviData.findIndex((navi, index) => {
      // if (navi.scene.isDefault === 1) {
      // }
      return navi.scene.isDefault === 1;
    });
    const idx = index < 0 ? 0 : index;
    this.curSceneIndex = idx;
    this.curScene = this.naviData[idx];
  }
  setScene() {
    this.viewer.polygonRenderer.setPolygons([]);
    this.viewer.lineRenderer.setLines([]);
    const { scene } = this.curScene;
    const sourceData = this.makeSourceData();
    // this.viewer.animateStepArg.toRotation = scene.rotation
    this.viewer.setScene(
      sourceData.thumb,
      sourceData.slices,
      {
        rotation: scene.rotation,
        correction: scene.correction,
        cb: () => {
          this.updateAll();
        }
      },
      {
        angleFar: scene.angleFar,
        angleInit: scene.angleInit,
        angleNear: scene.angleNear
      }
    );
  }
  updateAngle() {
    const { scene } = this.curScene;
    this.viewer.resetMouseArg({
      angleFar: scene.angleFar,
      angleInit: scene.angleInit,
      angleNear: scene.angleNear
    });
  }
  updateAll() {
    const { overlays, dots, lines, polygons } = this.curScene;
    const visibleDots = dots.filter((item) => !item.isHidden);
    const visibleLines = lines.filter((item) => !item.isHidden);
    const visiblePolygons = polygons.filter((item) => !item.isHidden);
    const visibleOverlays = (overlays || []).filter((x) => x.enable);
    this.renderOverlays(visibleOverlays);
    this.renderDots(visibleDots);
    this.viewer.lineRenderer?.setLines(visibleLines);
    this.viewer.polygonRenderer?.setPolygons(visiblePolygons);
  }
  getCorrection() {
    return this.viewer.getCorrectRotation();
  }
  getRotation() {
    return this.viewer.getManulRotation();
  }
  getCameraFov() {
    return this.viewer.getCameraCurrentFov();
  }
  saveRotation() {
    const index = this.curSceneIndex;
    const correction = this.getCorrection();
    const rotation = this.getRotation();
    this.naviData[index].scene.correction = correction;
    this.naviData[index].scene.rotation = rotation;
  }
  resetRotation() {
    const index = this.curSceneIndex;
    const correction = this.naviData[index].scene.correction;
    const rotation = this.naviData[index].scene.rotation;
    this.viewer.setInitRotation({
      correction,
      rotation
    });
  }
  rotateYaw(deg) {
    this.viewer.setYawRotation(deg);
  }
  rotatePitch(deg) {
    this.viewer.setPitchRotation(deg);
  }
  rotateRoll(deg) {
    this.viewer.setRollRotation(deg);
  }
  rotateX(deg) {
    this.viewer.setManulRotationX(deg);
  }
  rotateY(deg) {
    this.viewer.setManulRotationY(deg);
  }
  setMainScene(key) {
    this.naviData = this.naviData.map((navi) => {
      navi.scene.isDefault = 0;
      if (navi.scene.photo_key === key) {
        navi.scene.isDefault = 1;
      }
      return navi;
    });
  }
  renderOverlays(overlays) {
    this.viewer.clearOverlay();
    for (let i = 0; i < overlays.length; i++) {
      const entity = overlays[i];
      if (_.isNil(entity.x) || _.isNil(entity.y)) {
        const angles = this.viewer.pixelToAngle();
        entity.x = angles.lg;
        entity.y = angles.lt;
      }
      const dom = this.createOverlay(entity);
      const overlay = new Overlay(dom, entity);
      this.viewer.addOverlay(overlay);
    }
  }
  renderDots(dots) {
    this.viewer.clearDots();
    for (let i = 0; i < dots.length; i++) {
      const dom = this.createDotDom(dots[i]);
      const dot = new TagDot(dom, dots[i]);
      this.viewer.addDot(dot);
    }
  }
  createOverlay(entity) {
    entity.uid = _.uniqueId('overlay_');
    const dom = document.createElement('div');
    const text = document.createElement('label');
    text.className = 'overlay__label';
    text.innerHTML = entity.title;
    dom.appendChild(text);

    const arrow = document.createElement('img');
    arrow.className = 'overlay__arrow';
    // arrow.src = '/assets/vr/vr_navi_arrow.png'
    arrow.src = entity.icon || import.meta.env.VITE_BASE_PATH + '/assets/vr/vr_navi_arrow.png';
    arrow.setAttribute('draggable', 'false');
    dom.appendChild(arrow);
    // const title = document.createElement('span')
    // title.innerHTML = entity.title
    // const btnBox = document.createElement('div')
    // const delbtn = document.createElement('span')
    // delbtn.innerHTML = '删除'
    // delbtn.onclick = (e) => {
    //   e.cancelBubble = true
    //   this.viewer.delOneOverlay(entity.uid)
    //   const index = this.curSceneIndex
    //   this.naviData[index].overlays.splice(this.curOverlayIndex, 1)
    // }
    // btnBox.appendChild(delbtn)
    // dom.appendChild(title)
    // dom.appendChild(btnBox)
    // dom.setAttribute('data-title', entity.title)
    dom.setAttribute('data-x', entity.x);
    dom.setAttribute('data-y', entity.y);
    dom.setAttribute('data-uid', entity.uid);
    dom.className = 'overlay';
    dom.addEventListener('mousedown', this.handleOverlayMouseDown);
    return dom;
  }
  createDotDom(entity) {
    entity.uid = _.uniqueId('dot_');
    const dom = document.createElement('div');
    dom.className = 'tag-dot';
    dom.setAttribute('data-x', entity.x);
    dom.setAttribute('data-y', entity.y);
    dom.setAttribute('data-uid', entity.uid);
    // dom.setAttribute('data-title', entity.title)

    const wrapper = document.createElement('div');
    wrapper.className = 'tag-dot__wrapper';
    dom.appendChild(wrapper);

    const text = document.createElement('div');
    text.className = 'tag-dot__label';
    if (entity?.titleFontSize) {
      text.style.fontSize = entity.titleFontSize + 'px';
    }
    if (entity?.titleColor) {
      text.style.color = entity.titleColor;
    }
    text.innerHTML =
      getByteLen(entity.title) < 20
        ? entity.title
        : `<span>${entity.title}</span><div class='tips'>${entity.title}</div>`;
    text.addEventListener('mousedown', this.handleDotMouseDown);
    wrapper.appendChild(text);

    const icon = document.createElement('img');
    icon.className = 'tag-dot__icon';
    icon.setAttribute('draggable', 'false');
    icon.src = entity.markPic || import.meta.env.VITE_BASE_PATH + 'assets/vr/dot_tag.png';
    icon.addEventListener('click', () => {
      emitter.emit('ON_DOT_SELECTED', entity);
    });
    wrapper.appendChild(icon);
    if (entity.enableTooltip) {
      icon.addEventListener('click', this.toggleTooltip);

      const tooltip = document.createElement('div');
      tooltip.className = `tag-dot__tooltip tooltip-${entity.contentSizeType}`;
      tooltip.innerHTML = entity.content ? base64ToStr(entity.content) : '';
      wrapper.appendChild(tooltip);
    }

    return dom;
  }
  getViewerDefaultAngle() {
    const angles = this.viewer.pixelToAngle();
    return {
      ...angles
    };
  }
  addOverlay(entity) {
    if (_.isNil(entity.x) || _.isNil(entity.y)) {
      const angles = this.viewer.pixelToAngle();
      entity.x = angles.lg;
      entity.y = angles.lt;
    }
    const dom = this.createOverlay(entity);
    const overlay = new Overlay(dom, entity);
    this.viewer.addOverlay(overlay);
    this.naviData[this.curSceneIndex].overlays.push(entity);
  }
  walkTo(key) {
    this.curScene = this.naviData.find((pano, index) => {
      if (pano.scene.photo_key === key) {
        this.curSceneIndex = index;
      }
      return pano.scene.photo_key === key;
    });
    this.viewer.clearOverlay();
    this.viewer.clearDots();
    this.setScene();
  }

  getTitle() {
    const title = `点标记${this.uniqueId}`;
    this.uniqueId++;
    const finded = this.curScene.dots.find((d) => d.title === title);
    return finded ? this.getTitle() : title;
  }

  handleCanvasClick(e) {
    const x = e.layerX;
    const y = e.layerY;
    const angles = this.viewer.pixelToAngle(x, y);
    const entity = {
      x: angles.lg,
      y: angles.lt,
      title: this.getTitle(),
      enableTooltip: false, // 是否显示弹窗信息
      content: ''
    };
    const dom = this.createDotDom(entity);
    const dot = new TagDot(dom, entity);
    this.viewer.addDot(dot);
    emitter.emit('CREATE_DOT_TAG_DATA', dot.data);
    this.cancleAddDot();
  }
  startAddDot() {
    this.addingDot = true;
    this.viewer.mouseControl.setActive(false);
    this.viewer.canvas.style.cursor = 'url(/assets/vr/dot_tag.ico),default';
    this.viewer.canvas.addEventListener('mousedown', this.handleCanvasClick);
  }
  cancleAddDot() {
    this.addingDot = false;
    this.viewer.mouseControl.setActive(true);
    this.viewer.canvas.style.cursor = 'default';
    this.viewer.canvas.removeEventListener('mousedown', this.handleCanvasClick);
  }
  handleOverlayMouseDown(e) {
    e.cancelBubble = true;
    this.mouse.initX = parseFloat(e.currentTarget.dataset.x);
    this.mouse.initY = parseFloat(e.currentTarget.dataset.y);
    this.curOverlay = this.viewer.getOverlays().filter((item, index) => {
      if (item.data.uid === e.currentTarget.dataset.uid) {
        this.curOverlayIndex = index;
      }
      return item.data.uid === e.currentTarget.dataset.uid;
    })[0];
    this.mouse.mouseDownX = e.clientX;
    this.mouse.mouseDownY = e.clientY;
    document.addEventListener('mousemove', this.handleOverlayMouseMove);
    document.addEventListener('mouseup', this.handleOverlayMouseUp);
  }
  handleOverlayMouseMove(e) {
    e.cancelBubble = true;
    e.preventDefault();

    const diffX = e.clientX - this.mouse.mouseDownX;
    const diffY = e.clientY - this.mouse.mouseDownY;

    const x = this.mouse.initX + diffX;
    const y = this.mouse.initY + diffY;

    const angles = this.viewer.pixelToAngle(x, y);
    this.curOverlay.setDirAngle(angles.lg, angles.lt);
  }
  handleOverlayMouseUp(e) {
    const index = this.curSceneIndex;
    // this.naviData[index].overlays[this.curOverlayIndex] = this.curOverlay.data
    emitter.emit('UPDATE_OVERLAY_DATA', this.curOverlay.data);
    document.removeEventListener('mousemove', this.handleOverlayMouseMove);
    document.removeEventListener('mouseup', this.handleOverlayMouseUp);
  }
  handleDotMouseDown(e) {
    e.cancelBubble = true;
    const target = e.currentTarget.parentNode.parentNode;
    this.mouse.initX = parseFloat(target.dataset.x);
    this.mouse.initY = parseFloat(target.dataset.y);
    this.curDot = this.viewer.getTagDots().find((item, index) => {
      return item.data.uid === target.dataset.uid;
    });
    this.mouse.mouseDownX = e.clientX;
    this.mouse.mouseDownY = e.clientY;
    document.addEventListener('mousemove', this.handleDotMouseMove);
    document.addEventListener('mouseup', this.handleDotMouseUp);
  }
  handleDotMouseMove(e) {
    e.cancelBubble = true;
    e.preventDefault();

    if (!this.curDot) return;

    const diffX = e.clientX - this.mouse.mouseDownX;
    const diffY = e.clientY - this.mouse.mouseDownY;

    const x = this.mouse.initX + diffX;
    const y = this.mouse.initY + diffY;

    const angles = this.viewer.pixelToAngle(x, y);
    this.curDot.setDirAngle(angles.lg, angles.lt);
  }
  handleDotMouseUp(e) {
    emitter.emit('UPDATE_DOT_TAG_DATA', this.curDot.data);
    document.removeEventListener('mousemove', this.handleDotMouseMove);
    document.removeEventListener('mouseup', this.handleDotMouseUp);
  }
  toggleTooltip(e) {
    e.cancelBubble = true;
    const parent = e.currentTarget.parentNode;
    parent.classList.toggle('isActive');
    // 防止点击点弹出被其他点覆盖
    document.querySelectorAll('.tag-dot').forEach((i) => {
      i.style['zIndex'] = 1000;
    });
    if (parent.parentNode) {
      parent.parentNode.style['zIndex'] = 1001;
    }
  }
  makeSourceData() {
    const { scene } = this.curScene;
    const data = {
      ...scene.sphereSource
    };
    return data;
  }
}
