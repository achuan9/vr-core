import TapHandler from './taphandler';

export default class GlassesButton {
  constructor(openButton, exitButton) {
    this.focusAble = true;
    this.walkOverlays = [];
    this.countTime = 2;
    this.openButton = openButton;
    this.exitButton = exitButton;
  }
  setViewer(viewer) {
    this.viewer = viewer;
    this.container = this.viewer.getContainer();
  }
  setTraveller(traveller) {
    this.traveller = traveller;
  }
  render() {
    // 隐藏vr按钮
    return;
    this.computeSize();
    this.createDom();
    this.reposition();
    this.bindEvents();
  }
  computeSize() {
    const size = this.getSize();
    if (size.width == this.oldWidth && size.height == this.oldHeight) {
      return;
    }

    this.oldWidth = size.width;
    this.oldHeight = size.height;
    this.focuserW = 50;
    this.focuserH = 50;
    this.focuserL = size.width / 2 - this.focuserW / 2;
    this.focuserT = size.height / 2 - this.focuserH / 2;
  }
  getSize() {
    return this.fullscreen ? { width: screen.width, height: screen.height } : this.viewer.getSize();
  }
  createDom() {
    if (!this.openButton) {
      this.openButton = document.createElement('img');
      this.openButton.src =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAAjBAMAAAA6UnQPAAAAA3NCSVQICAjb4U/gAAAAMFBMVEX///////////////////////////////////////////////////////////////9Or7hAAAAAEHRSTlMAESIzRFVmd4iZqrvM3e7/dpUBFQAAAAlwSFlzAAALEgAACxIB0t1+/AAAABx0RVh0U29mdHdhcmUAQWRvYmUgRmlyZXdvcmtzIENTNXG14zYAAAAWdEVYdENyZWF0aW9uIFRpbWUAMDQvMjcvMTeK+gxIAAAA9klEQVQ4jWNgvvcOJ3hrwODzHw84wvAen/Q/Bnyy//8T0j3kpU+kr0OIvirrQZV+xsDAtB4m+0uBgSEPRdqAgYGBEyY9AchhRpb+zgAC9yGyf8GceiTph2CRfIj0NzBHDkl6A1hEHyL9CczhRpKeABaRh0h/BHM4iddNwG4CLv8H8/ff+zB/v0cOlqcMDIzz////Y8AEJH8KMDDEYQvzixAzMMIcCgKAhiALoEqDHdWPU/oHku+xSH8GSfPglL4AkubAKb0AJM2CUzoAJI3sdNQ8pgAOzv1IIsi6/zAgQhumGyl/QyKGQQ8hcoQBqXQ4CJHmQCodADI0U7bzmOcFAAAAAElFTkSuQmCC';
      this.openButton.className = 'glass-btn';
      this.container.appendChild(this.openButton);
    }

    if (!this.exitButton) {
      this.exitButton = document.createElement('div');
      this.exitButton.style.display = 'none';
      this.exitButton.className = 'glass-exitbtn glass-exitbtn2';
      this.exitButton.innerHTML = '退出VR';
      this.container.appendChild(this.exitButton);
    }
    const createCenter = function (width, height) {
      const center = document.createElement('div');
      center.className = 'center-point';
      center.style.width = `${width}px`;
      center.style.height = `${height}px`;
      center.style.borderRadius = `${width}px`;
      return center;
    };
    const createFocuser = function (width, height) {
      const focuser = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      focuser.style.left = 0;
      focuser.style.top = 0;
      focuser.style.display = 'none';
      focuser.style.position = 'absolute';
      focuser.style.width = `${width}px`;
      focuser.style.height = `${height}px`;

      focuser.style['strokeDasharray'] = '5,5';
      focuser.style['fill'] = 'none';
      focuser.style['strokeWidth'] = '1px';
      focuser.style['strokeLinecap'] = 'round';

      const circle1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      circle1.setAttribute('role', 'background');
      circle1.style.position = 'absolute';
      circle1.setAttribute('stroke', 'white');

      const circle2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      circle2.setAttribute('role', 'foreground');
      circle2.style.position = 'absolute';
      circle2.setAttribute('stroke', 'red');

      focuser.appendChild(circle1);
      focuser.appendChild(circle2);

      return focuser;
    };

    this.focuserLeft = createFocuser(this.focuserW, this.focuserH);
    this.container.appendChild(this.focuserLeft);
    this.focuserRight = createFocuser(this.focuserW, this.focuserH);
    this.container.appendChild(this.focuserRight);
    this.backCircleLeft = this.focuserLeft.querySelector('[role=background]');
    this.backCircleRight = this.focuserRight.querySelector('[role=background]');
    this.foreCircleLeft = this.focuserLeft.querySelector('[role=foreground]');
    this.foreCircleRight = this.focuserRight.querySelector('[role=foreground]');
    this.drawWhiteFocuser();

    this.centerLeft = createCenter(this.focuserW, this.focuserH);
    this.container.appendChild(this.centerLeft);

    this.centerRight = createCenter(this.focuserW, this.focuserH);
    this.container.appendChild(this.centerRight);
  }
  reposition() {
    const size = this.getSize(),
      centerScale = 0.08;

    if (size.width < size.height) {
      const base = size.height / 4;
      this.transform(this.focuserLeft, this.focuserL, this.focuserT - base);
      this.transform(this.focuserRight, this.focuserL, this.focuserT + base);

      this.transform(this.centerLeft, this.focuserL, this.focuserT - base, 0, centerScale);
      this.transform(this.centerRight, this.focuserL, this.focuserT + base, 0, centerScale);
    } else {
      const base = size.width / 4;
      this.transform(this.focuserLeft, this.focuserL - base, this.focuserT);
      this.transform(this.focuserRight, this.focuserL + base, this.focuserT);

      this.transform(this.centerLeft, this.focuserL - base, this.focuserT, 0, centerScale);
      this.transform(this.centerRight, this.focuserL + base, this.focuserT, 0, centerScale);
    }
  }
  transform(element, left, top, rotate, scale) {
    if (!scale) {
      scale = 1;
    }

    if (!rotate) {
      rotate = 0;
    }

    const transform = `translate(${left}px, ${top}px) translateZ(0) rotate(${rotate}deg) scale(${scale})`;
    element.style.webkitTransform = transform;
    element.style.transform = transform;
    // 'translate(' + left + 'px, ' + top + 'px) translateZ(0) rotate(' + rotate + 'deg) scale(' + scale + ')';
  }
  bindEvents() {
    const tapHandler1 = new TapHandler(this.openButton);
    tapHandler1.listen(this.showGlassesMode.bind(this));

    const tapHandler2 = new TapHandler(this.container);
    tapHandler2.listen(this.showExitButton.bind(this));

    const tapHandler3 = new TapHandler(this.exitButton);
    tapHandler3.listen(this.hideGlassesMode.bind(this));
  }
  showGlassesMode(e) {
    e.stopPropagation();
    this.hideOpenButton();
    // this.needReposition = true;
    this.glassesMode = true;
    this.viewer.enableVRMode();
    //
    this.setFullScreen(true);
    this.requestRedrawOverlay();
    this.centerLeft.style.display = 'block';
    this.centerRight.style.display = 'block';
    // if(this.focusAble) {
    // 	this.displayElement(this.centerLeft, '');
    // 	this.displayElement(this.centerRight, '');
    //
    // 	requestAnimationFrame(this.detectHits_);
    // }
  }
  hideGlassesMode(e) {
    e.stopPropagation();
    this.hideExitButton();
    this.showOpenButton();
    this.glassesMode = false;
    this.viewer.disableVRMode();
    //
    this.setFullScreen(false);
    this.requestRedrawOverlay();
    this.centerLeft.style.display = 'none';
    this.centerRight.style.display = 'none';
    // if(this.focusAble) {
    // 	this.displayElement(this.rotationTip, 'none');
    //
    // 	this.displayElement(this.focuserLeft, 'none');
    // 	this.displayElement(this.focuserRight, 'none');
    //
    // 	this.displayElement(this.centerLeft, 'none');
    // 	this.displayElement(this.centerRight, 'none');
    // }
  }
  // 开启、关闭全屏
  setFullScreen(bool) {
    const docElm = document.body;
    this.fullscreen = bool;
    if (bool) {
      if (docElm.requestFullscreen) {
        // W3C
        docElm.requestFullscreen();
      } else if (docElm.mozRequestFullScreen) {
        // FireFox
        docElm.mozRequestFullScreen();
      } else if (docElm.webkitRequestFullScreen) {
        // Chrome等
        docElm.webkitRequestFullScreen();
      } else if (docElm.msRequestFullscreen) {
        // IE11
        docElm.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.webkitCancelFullScreen) {
        document.webkitCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  }
  showExitButton() {
    if (!this.glassesMode) {
      return;
    }

    if (this.exitButton.style.display == 'none') {
      this.exitButton.style.display = 'block';
    } else {
      this.exitButton.style.display = 'none';
    }
  }
  hideExitButton() {
    this.exitButton.style.display = 'none';
  }
  showOpenButton() {
    this.openButton.style.display = 'block';
  }
  hideOpenButton() {
    this.openButton.style.display = 'none';
  }
  drawWhiteFocuser() {
    const r = this.focuserW / 2;
    let circleAngle = -90;
    const d = [];
    let i = 0;
    while (true) {
      circleAngle += 10;
      if (i == 36) {
        break;
      }

      const radians = (circleAngle / 180) * Math.PI;
      const x = r + Math.cos(radians) * r;
      const y = r + Math.sin(radians) * r;

      if (i == 0) {
        d.push('M ');
      } else {
        d.push('L ');
      }

      d.push(x + ' ' + y + ' ');
      i++;
    }

    this.backCircleLeft.setAttribute('d', d.join(''));
    this.backCircleRight.setAttribute('d', d.join(''));
  }
  // 切换到vr模式需要重新渲染overlays
  requestRedrawOverlay() {
    this.traveller.setScene();
  }
  startCountMode() {
    this.focuserLeft.style.display = 'block';
    this.focuserRight.style.display = 'block';
    if (!this.focuserTimer) {
      this.foreCircleLeft.setAttribute('d', '');
      this.foreCircleRight.setAttribute('d', '');
      this.circleAngle = -90;
      this.countTime = 0;
      this.focuserTimer = setInterval(this.countFocuserTime.bind(this), 24);
    }
  }
  setCurrentOverlay(overlay) {
    this.currentWalkOverlay = overlay;
    const size = this.getSize();
  }
  getFocus() {
    const size = this.getSize();
    let { focuserL, focuserT } = this;
    const { focuserW, focuserH } = this;
    if (size.width < size.height) {
      focuserT = focuserT - size.height / 4;
    } else {
      focuserL = focuserL - size.width / 4;
    }
    return {
      focuserL,
      focuserW,
      focuserT,
      focuserH
    };
  }
  countFocuserTime() {
    if (!this.currentWalkOverlay) {
      this.focuserLeft.style.display = 'none';
      this.focuserRight.style.display = 'none';
      clearInterval(this.focuserTimer);
      this.focuserTimer = null;
      return;
    }

    if (this.countTime == 36) {
      clearInterval(this.focuserTimer);
      this.focuserTimer = null;
      this.focuserLeft.style.display = 'none';
      this.focuserRight.style.display = 'none';
      this.currentWalkOverlay.handleClick();
    } else {
      this.circleAngle += 10;
      const radians = (this.circleAngle / 180) * Math.PI;

      const r = this.focuserW / 2;
      const x = r + Math.cos(radians) * r;
      const y = r + Math.sin(radians) * r;

      let d = this.foreCircleLeft.getAttribute('d');
      if (this.countTime == 0) {
        d += 'M ';
      } else {
        d += 'L ';
      }
      d += x + ' ' + y + ' ';

      this.foreCircleLeft.setAttribute('d', d);
      this.foreCircleRight.setAttribute('d', d);

      this.countTime++;
    }
  }
}
