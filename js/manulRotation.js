// import { Euler } from 'three/src/math/Euler';
// import { _Math } from 'three/src/math/Math';

import Rotation from './rotation';

export default class ManulRotation extends Rotation {
  constructor(alpha, beta, gamma) {
    super(alpha, beta, gamma);
  }
  getQuat() {
    const z = this.gamma;
    const x = this.beta;
    const y = -this.alpha;
    this.setQuaternion(this.quat, z, x, y);
    return this.quat;
  }
  setQuaternion(quaternion, z, x, y) {
    const euler = new THREE.Euler();

    const order = 'ZYX';
    euler.set(
      THREE.MathUtils.degToRad(x),
      THREE.MathUtils.degToRad(y),
      THREE.MathUtils.degToRad(z),
      order
    ); // 'ZXY' for the device, but 'YXZ' for us

    quaternion.setFromEuler(euler); // orient the device
  }
}
