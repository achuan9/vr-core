import { Earcut } from 'three/src/extras/Earcut';

// 不使用threejs版本r124代码
// import 'three/examples/js/lines/LineSegmentsGeometry.js';
// import 'three/examples/js/lines/LineSegments2.js';
// import 'three/examples/js/lines/Line2.js';
// import 'three/examples/js/lines/LineGeometry.js';
// import 'three/examples/js/lines/LineMaterial.js';

// 引入threejs版本r153代码
import './lines/LineSegmentsGeometry.js';
import './lines/LineSegments2.js';
import './lines/Line2.js';
import './lines/LineGeometry.js';
import './lines/LineMaterial';

function parseCSSColor(colorString) {
  // 判断是否为十六进制颜色表示（#开头）
  if (colorString.startsWith('#')) {
    // 去掉 # 号
    colorString = colorString.substr(1);

    // 根据颜色字符串的长度来判断是 3 位还是 6 位的十六进制颜色
    if (colorString.length === 3) {
      // 将 3 位的十六进制颜色扩展为 6 位
      colorString = colorString
        .split('')
        .map((char) => char + char)
        .join('');
    }

    // 解析红、绿、蓝分量的值
    const red = parseInt(colorString.substr(0, 2), 16);
    const green = parseInt(colorString.substr(2, 2), 16);
    const blue = parseInt(colorString.substr(4, 2), 16);

    // 返回解析得到的颜色值
    return {
      red,
      green,
      blue
    };
  }

  // 判断是否为 rgba() 颜色表示
  if (colorString.startsWith('rgba(')) {
    // 提取括号中的参数部分
    const params = colorString.slice(5, -1).split(',');

    // 解析红、绿、蓝分量的值和 alpha 值
    const red = parseInt(params[0]);
    const green = parseInt(params[1]);
    const blue = parseInt(params[2]);
    const alpha = parseFloat(params[3]);

    // 返回解析得到的颜色值
    return {
      red,
      green,
      blue,
      alpha
    };
  }

  // 无法解析的颜色格式，返回 null 或者其他适当的默认值
  return null;
}
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(1, 1);
export default class renderWithThreejs {
  constructor(viewer) {
    this.polygonEditPainter = viewer.polygonRenderer;
    this.lineEditPainter = viewer.lineRenderer;
    this.viewer = viewer;
    this.meshMap = {};
    this.meshGroup = new THREE.Group();
    this.lineGroup = new THREE.Group();
    this.viewer.scene?.add(this.meshGroup);
    this.viewer.scene?.add(this.lineGroup);
    this.lineTag = '_line';
    this.firstFrame = true;
    this.multiScalar = 0.9;
    this.initClickEvent();
  }

  initClickEvent() {
    // click事件
    this.eventClickRraycaster = new THREE.Raycaster();

    const onClick = (e) => {
      const vector = new THREE.Vector2(1, 1);

      vector.x = (e.clientX / this.viewer.canvas.clientWidth) * 2 - 1;
      vector.y = -(e.clientY / this.viewer.canvas.clientHeight) * 2 + 1;

      this.eventClickRraycaster.setFromCamera(vector, this.viewer.camera);

      // 判断是否点击了多边形
      this.meshGroup.children.forEach((i) => {
        const intersects = raycaster.intersectObject(i);
        if (intersects.length < 1) {
          return;
        }
        const name = intersects[0].object?.name;
        const polygon = this.polygonEditPainter.polygons.filter((item) => item.uid == name)[0];
        if (polygon) {
          // 因为在polygonEditPainter.js中往第一个point上添加了弹窗子元素
          polygon.points[0].dom.classList.toggle('isActive');
        }
      });
      // 判断是否点击了线

      this.lineGroup.children.forEach((i) => {
        const intersects = raycaster.intersectObject(i);
        if (intersects.length < 1) {
          return;
        }
        const name = intersects[0].object?.name;
        const line = this.lineEditPainter.lines.filter((item) => item.uid == name)[0];
        if (line) {
          // 因为在lineEditPainter.js中往第一个point上添加了弹窗子元素
          line.points[0].dom.classList.toggle('isActive');
        }
      });
    };

    this.viewer.canvas.addEventListener('click', onClick);
  }

  drawLine2(
    points,
    closed = true,
    lineColor = { red: 255, green: 255, blue: 255 },
    lineWidth = 2,
    lineType = 'solid'
  ) {
    const TlineColor = new THREE.Color(
      lineColor.red / 255,
      lineColor.green / 255,
      lineColor.blue / 255
    );
    const opacity = lineColor.alpha || 1;
    const positions = [];
    const colors = [];
    const tmpPoints = closed ? [...points, points[0]] : points;
    const tmpColor = TlineColor || new THREE.Color(1, 0, 0);
    const color = new THREE.Color();
    const dashed = lineType == 'solid' ? false : true;
    const dashSize = lineWidth;
    const dashScale = 1 / lineWidth;

    for (let i = 0, l = tmpPoints.length; i < l; i++) {
      positions.push(tmpPoints[i].x, tmpPoints[i].y, tmpPoints[i].z);
      color.setHSL(tmpColor.r, tmpColor.g, tmpColor.b, THREE.SRGBColorSpace);
      colors.push(color.r, color.g, color.b);
    }

    // Line2 ( LineGeometry, LineMaterial )
    const geometry = new THREE.LineGeometry();
    geometry.setPositions(positions);
    geometry.setColors(colors);

    let matLine = new THREE.LineMaterial({
      transparent: true,
      resolution: new THREE.Vector2(1, 1),
      color: tmpColor || 0xffffff,
      linewidth: lineWidth || 1, // in world units with size attenuation, pixels otherwise
      dashed: dashed,
      opacity: opacity,
      dashSize,
      dashScale,
      worldUnits: true,
      gapSize: lineWidth / 5
    });

    let line = new THREE.Line2(geometry, matLine);
    line.computeLineDistances();
    line.scale.set(1, 1, 1);
    // matLine.worldUnits = false
    // matLine.needsUpdate = true
    // matLine.linewidth = 1
    // matLine.alphaToCoverage = true
    // matLine.dashed = false
    // matLine.dashScale = 0.5
    // matLine.dashSize = 2
    // matLine.dashSize = 1
    // this.viewer.scene.add(line);
    return line;
  }
  drawLine(points, TlineColor, lineWidth) {
    const geometry = new THREE.BufferGeometry().setFromPoints([...points, points[0]]);
    const materialLine = new THREE.LineBasicMaterial({
      transparent: true,
      color: TlineColor || 0xffffff,
      linewidth: lineWidth || 1
    });
    const line = new THREE.Line(geometry, materialLine);
    return line;
  }
  renderLine(line) {
    if (line.points.length < 1) {
      return;
    }
    var points = line.points.map((i) => {
      let { x, y, z } = i.tagMesh.position;
      let tmp = new THREE.Vector3(x, y, z).multiplyScalar(this.multiScalar);
      return tmp;
    });
    let threeline;
    line.lineColor;
    line.lineColorHover;
    line.lineType;
    line.lineTypeHover;
    line.lineWidth;
    line.lineWidthHover;
    const lineColor = parseCSSColor(line.lineColor || 'rgba(200,200,200,0.5)');

    const lineType = line.lineType || 'solid';
    const lineWidth = line.lineWidth || 10;
    threeline = this.drawLine2(points, false, lineColor, lineWidth, lineType);
    threeline.name = line.uid;
    this.lineGroup.remove(this.meshMap[line.uid]);
    this.lineGroup.add(threeline);
    this.meshMap[line.uid] = threeline;
  }
  renderPolygon(polygon) {
    // return;
    if (polygon.points.length < 2) {
      return;
    }
    let vertices = [];
    let vertices2 = [];
    polygon.points.forEach((i) => {
      vertices.push(i.dirAngle.x, i.dirAngle.y);
    });
    var points = polygon.points.map((i) => {
      let { x, y, z } = i.tagMesh.position;
      let tmp = new THREE.Vector3(x, y, z).multiplyScalar(this.multiScalar);
      vertices2.push(tmp.x, tmp.y, tmp.z);
      return tmp;
    });

    const vertices3 = new Float32Array(vertices2);

    const indices = Earcut.triangulate(vertices);

    // 创建自定义几何体
    var surfaceGeometry = new THREE.BufferGeometry();
    surfaceGeometry.setIndex(indices);
    surfaceGeometry.setAttribute('position', new THREE.BufferAttribute(vertices3, 3));
    // surfaceGeometry.vertices = points;
    // 创建面
    // for (let i = 0; i < indices.length; i = i + 3) {
    //   surfaceGeometry.faces.push(new THREE.Face3(indices[i], indices[i + 1], indices[i + 2]));
    // }

    // 计算法线
    // surfaceGeometry.computeFaceNormals();

    // 创建曲面网格对象
    const fillColor = parseCSSColor(polygon.fillColor || 'rgba(200,200,200,0.5)');
    const TfillCollor = new THREE.Color(
      fillColor.red / 255,
      fillColor.green / 255,
      fillColor.blue / 255
    );
    const lineColor = parseCSSColor(polygon.lineColor || 'rgba(200,200,200,0.5)');

    const lineType = polygon.lineType || 'solid';
    const lineWidth = polygon.lineWidth || 10;

    const material = new THREE.MeshBasicMaterial({
      transparent: true, //开启透明
      color: TfillCollor,
      opacity: fillColor.alpha || 0.5,
      side: THREE.DoubleSide
    });
    var surfaceMesh = new THREE.Mesh(surfaceGeometry, material);
    surfaceMesh.name = polygon.uid;

    //画线
    let line;
    line = this.drawLine2(points, true, lineColor, lineWidth, lineType);
    line.name = polygon.uid + this.lineTag;
    surfaceMesh.children.push(line);

    // 加入组中渲染
    this.meshGroup.remove(this.meshMap[polygon.uid]);
    this.meshGroup.add(surfaceMesh);
    this.meshMap[polygon.uid] = surfaceMesh;
    this.meshMap[polygon.uid + this.lineTag] = line ? line : null;
    // this.removeNeedlessPolygons();
    if (this.polygonEditPainter.drawMoveArg) {
      if (this.meshGroup.children.length == this.polygonEditPainter.polygons.length) {
        mouse.x = (this.polygonEditPainter.drawMoveArg.x / this.viewer.canvas.width) * 2 - 1;
        mouse.y = -(this.polygonEditPainter.drawMoveArg.y / this.viewer.canvas.height) * 2 + 1;
        raycaster.setFromCamera(mouse, this.viewer.camera);
        const meshes = this.meshGroup.children;
        meshes.forEach((i) => {
          const intersection = raycaster.intersectObject(i);
          if (intersection.length > 0) {
            const mesh = intersection[0].object;
            const name = mesh.name;
            const polygon = this.polygonEditPainter.polygons.filter((item) => item.uid == name)[0];
            if (polygon) {
              const fillColorHover = parseCSSColor(
                polygon.fillColorHover || 'rgba(200,200,200,0.9)'
              );
              const TfillColorHover = new THREE.Color(
                fillColorHover.red / 255,
                fillColorHover.green / 255,
                fillColorHover.blue / 255
              );

              const lineColorHover = parseCSSColor(
                polygon.lineColorHover || 'rgba(200,200,200,0.9)'
              );
              const TlineColorHover = new THREE.Color(
                lineColorHover.red / 255,
                lineColorHover.green / 255,
                lineColorHover.blue / 255
              );
              const lineTypeHover = polygon.lineTypeHover || 'solid';
              const lineWidthHover = polygon.lineWidthHover || 10;

              const material = new THREE.MeshBasicMaterial({
                transparent: true, //开启透明
                color: TfillColorHover,
                opacity: fillColorHover.alpha || 0.9,
                side: THREE.DoubleSide
              });
              mesh?.material.setValues(material);
              const meshLine = mesh.children[0];
              if (meshLine) {
                if (meshLine.material) {
                  const lineWidth = lineWidthHover;
                  const dashSize = lineWidthHover;
                  const dashScale = 1 / lineWidthHover;
                  const opacity = lineColorHover.alpha || 1;
                  const dashed = lineTypeHover == 'solid' ? false : true;
                  let matLine = new THREE.LineMaterial({
                    transparent: true,
                    resolution: new THREE.Vector2(1000, 1000),
                    color: TlineColorHover || 0xffffff,
                    linewidth: lineWidth || 1,
                    dashed: dashed,
                    opacity: opacity,
                    dashSize,
                    dashScale
                  });
                  // 防止输出警告
                  delete matLine.index0AttributeName;
                  meshLine.material.setValues(matLine);
                } else {
                  const lineMaterial = new THREE.LineBasicMaterial({
                    transparent: true,
                    color: TlineColorHover,
                    linewidth: lineWidthHover
                  });
                  meshLine?.material.setValues(lineMaterial);
                }
              }
            }
          }
        });
      }
    }
  }
  clear() {
    for (let i = this.meshGroup.children.length - 1; i > -1; i--) {
      this.meshGroup.remove(this.meshGroup.children[i]);
    }
    for (let i = this.lineGroup.children.length - 1; i > -1; i--) {
      this.lineGroup.remove(this.lineGroup.children[i]);
    }
    this.meshMap = {};
  }
  removeNeedlessPolygons() {
    const uids = this.polygonEditPainter.polygons.map((i) => i.uid);
    for (let key in this.meshMap) {
      if (!uids.includes(key)) {
        this.meshGroup.remove(this.meshMap[key]);
      }
    }
  }
  dispose() {
    this.meshGroup.children.forEach((i) => {
      this.meshGroup.remove(i);
    });
    this.viewer.scene?.remove(this.meshGroup);
    this.lineGroup.children.forEach((i) => {
      this.lineGroup.remove(i);
    });
    this.viewer.scene?.remove(this.lineGroup);
  }
}
