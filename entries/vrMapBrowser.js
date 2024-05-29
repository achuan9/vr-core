import VrViewer from './vrView';
import Overlay from '../js/overlay';
import TagDot from '../js/tagDot.js';
import _ from 'lodash-es';
import { useEmitt } from '@sutpc/portal/src/hooks';
import { getByteLen } from '@/utils/methods';
import { base64ToStr } from '@/utils/base64';

const { emitter } = useEmitt();

export default class VrMapBrowser {
  constructor(data, container, entryPoint) {
    this.naviData = data;
    this.entryPoint = entryPoint;
    this.getCurScene();
    // const rotation = this.calcRotation();
    this.viewer = new VrViewer(container, {
      rotation: this.curScene?.scene?.rotation,
      enableAnimation: false
    });
    this.viewer.setTraveller(this);
    this.handleOverlayClick = this.handleOverlayClick.bind(this);
    this.toggleTooltip = this.toggleTooltip.bind(this);
    this.init();
  }
  init() {
    this.getCurScene();
    // this.setScene();
  }

  /**
   * 计算视角
   * TODO: 根据地图的相机姿态,计算输出的夹角
   */
  calcRotation() {
    const { northRotation } = this.entryPoint.innerObj;
    return northRotation || [180, 0, 0];
  }
  dispose() {
    this.viewer && this.viewer.dispose();
  }
  getCurScene() {
    const index = this.naviData.findIndex((navi, index) => {
      return navi.id === this.entryPoint?.subSceneId;
    });
    const idx = index < 0 ? 0 : index;
    this.curSceneIndex = idx;
    this.curScene = this.naviData[idx];
  }
  setData(data) {
    this.naviData = data;
    this.init();
    this.updateAll();
  }
  setScene() {
    const { curScene } = this,
      { scene, overlays, dots } = curScene;
    const sourceData = this.makeSourceData();
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
  updateAll() {
    const { overlays, dots, lines, polygons } = this.curScene;
    const visibleOverlays = (overlays || []).filter((x) => x.enable);
    this.renderOverlays(visibleOverlays);
    this.renderDots(dots);
    this.viewer.lineRenderer?.setLines(lines);
    this.viewer.polygonRenderer?.setPolygons(polygons);
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
      overlay.setTraveller(this);
      this.viewer.addOverlay(overlay);
    }
  }
  createOverlay(entity) {
    let dom;
    if (this.isGlassesMode()) {
      dom = document.createElement('div');
      dom.appendChild(this.makeOverlayDom(entity, 'left'));
      dom.appendChild(this.makeOverlayDom(entity, 'right'));
    } else {
      dom = this.makeOverlayDom(entity);
    }
    return dom;
  }
  makeOverlayDom(entity, optEye) {
    const dom = document.createElement('div');
    dom.className = 'overlay';
    if (optEye) {
      dom.setAttribute('eye', optEye);
    }
    const text = document.createElement('label');
    text.className = 'overlay__label';
    text.innerHTML = entity.title;
    dom.appendChild(text);
    const arrow = document.createElement('img');
    arrow.className = 'overlay__arrow';
    // arrow.src = '/assets/vr/vr_navi_arrow.png'
    arrow.src = entity.icon || import.meta.env.VITE_BASE_PATH + '/assets/vr/vr_navi_arrow.png';
    dom.appendChild(arrow);

    dom.addEventListener('touchend', () => {
      emitter.emit('TRAVELLER_WALK_TO', entity);
      // this.walkTo(entity.next_photo_key)
    });
    dom.addEventListener('click', () => {
      emitter.emit('TRAVELLER_WALK_TO', entity);
      // this.walkTo(entity.next_photo_key)
    });
    return dom;
  }
  renderDots(dots) {
    this.viewer.clearDots();
    for (let i = 0; i < dots.length; i++) {
      const dom = this.createDotDom(dots[i]);
      const dot = new TagDot(dom, dots[i]);
      this.viewer.addDot(dot);
    }
  }
  createDotDom(entity) {
    entity.uid = _.uniqueId('dot_');
    const dom = document.createElement('div');
    dom.className = 'tag-dot';

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
    wrapper.appendChild(text);

    const icon = document.createElement('img');
    icon.className = 'tag-dot__icon';
    icon.setAttribute('draggable', 'false');
    icon.src = entity.markPic || import.meta.env.VITE_BASE_PATH + 'assets/vr/dot_tag.png';
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
  // 跳转到其他场景
  walkTo(key) {
    this.curScene = this.naviData.filter((pano, index) => {
      if (pano.scene.photo_key === key) {
        this.curSceneIndex = index;
      }
      return pano.scene.photo_key === key;
    })[0];
    this.viewer.clearOverlay();
    this.viewer.clearDots();
    this.setScene();
  }
  // 切换dot的状态类名: isActive,
  // 并通过样式控制, 使tooltip元素显示隐藏
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
  // 获取缩略图及分割图url
  makeSourceData() {
    const { scene } = this.curScene;
    let data = {};
    // 支持webgl
    if (this.viewer.webglSupported()) {
      data = {
        ...scene.sphereSource
      };
    } else {
      data = {
        ...scene.cubeSource
      };
    }
    return data;
  }

  handleOverlayClick(key) {
    this.walkTo(key);
  }
  setGlassesButton(glassesButton) {
    if (!this.viewer || !this.viewer.webglSupported()) {
      return;
    }
    this.glassesButton = glassesButton;
    this.glassesButton.setTraveller(this);
    this.glassesButton.setViewer(this.viewer);
    this.glassesButton.render();
  }
  isGlassesMode() {
    if (!this.glassesButton) {
      return false;
    }
    return !!this.glassesButton.glassesMode;
  }
}
