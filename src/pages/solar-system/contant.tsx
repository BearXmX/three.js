import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export const sunRadius = 3;

// 黄赤交角（核心参数）
export const obliquity = 23.5; // 度
export const obliquityRad = THREE.MathUtils.degToRad(obliquity); // 弧度制黄赤交角

export const earthRadius = 2


/** 公转周期：36.5s 一圈 */
export const revolutionTimeInit = 36.5;
export const activeSolarTermsIndexInit = 0;
export const activeCameraIndexInit = 0;

/* 自转一圈时间 */
export const autoRevolutionTimeInit = (revolutionTimeInit / 365) * 50; // 0.1秒/圈

// 新增：自转相关计算参数
export const baseAngularVelocity = (2 * Math.PI) / autoRevolutionTimeInit; // 基础角速度(rad/s) 5s转一圈

// 节气配置（包含直射纬度）
export const solarTerms = [
  { name: '春分', angle: 0, directLat: 0 },               // 春分：右侧（0°）
  { name: '夏至', angle: -Math.PI / 2, directLat: obliquity }, // 夏至：上方（-90°，即270°）
  { name: '秋分', angle: -Math.PI, directLat: 0 },        // 秋分：左侧（-180°）
  { name: '冬至', angle: -Math.PI * 3 / 2, directLat: -obliquity } // 冬至：下方（-270°，即90°）
];

// 纬线
export const latitudes = [
  { lat: 0, color: '#ff1030', width: 0.03 },     // 赤道
  { lat: obliquity, color: '#f5f500', width: 0.03 }, // 北回归线
  { lat: 30, color: '#fff', width: 0.006 },
  { lat: 60, color: '#fff', width: 0.006 },
  { lat: -obliquity, color: '#f5f500', width: 0.03 },// 南回归线
  { lat: -30, color: '#fff', width: 0.006 },
  { lat: -60, color: '#fff', width: 0.006 },
];

// 经线
export const longitudes = [
  { lon: 0, color: '#00b96b' },
  { lon: 30, color: '#fff' },
  { lon: 60, color: '#fff' },
  { lon: 90, color: '#fff' },
  { lon: 120, color: '#fff' },
  { lon: 150, color: '#fff' },
  { lon: 180, color: '#fff' },
  { lon: 210, color: '#fff' },
  { lon: 240, color: '#fff' },
  { lon: 270, color: '#fff' },
  { lon: 300, color: '#fff' },
  { lon: 330, color: '#fff' },
  { lon: 360, color: '#04a9ff' },
];

// 静态配置
export const staticConfig = {
  radius: 25,                      // 轨道半径
  revolutionTime: revolutionTimeInit, // 公转周期（秒/圈）
  earthRotationSpeed: 0.02,        // 保留原始属性但不再使用
  sunlightIntensity: 2.5,          // 太阳光强度
  observeOrbitEarthBaseAngle: Math.PI / 8,
};

// 【新增1：圆柱配置（可调整粗细/平滑度）】
export const cylinderConfig = {
  radius: 0.15, // 圆柱半径（控制粗细，越大越粗）
  radialSegments: 16, // 径向分段（越大越平滑）
  color: '#fff', // 与原线条同色（橙色）
  initialHeight: 1, // 初始高度，用于后续计算缩放比例
  lengthScale: staticConfig.radius,
  opacity: 0.2       // 长度缩放因子（关键：控制显示长度，0.95表示实际长度的95%）
};

export const makeSun = (scene: THREE.Scene) => {
  const textureLoader = new THREE.TextureLoader();
  const suntexture = textureLoader.load(window.$$prefix + '/textures/sun.png');

  const sunGeometry = new THREE.SphereGeometry(sunRadius, 32, 32);
  const sunMaterial = new THREE.MeshBasicMaterial({ map: suntexture });
  const sun = new THREE.Mesh(sunGeometry, sunMaterial);
  sun.position.set(0, 0, 5);

  const sunLight = new THREE.DirectionalLight(0xffffff, staticConfig.sunlightIntensity);
  sunLight.castShadow = true;

  // 灯光阴影配置
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 5;
  sunLight.shadow.camera.far = 50;
  sunLight.shadow.camera.left = -20;
  sunLight.shadow.camera.right = 20;
  sunLight.shadow.camera.top = 20;
  sunLight.shadow.camera.bottom = -20;

  sun.add(sunLight);
  scene.add(sun);

  return {
    sun,
    sunLight
  }
};

export const makeAmbientLight_AxesHelper_OrbitControls = (scene: THREE.Scene, mainCamera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) => {
  /** 灯光 */
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
  scene.add(ambientLight);

  /** 坐标系辅助线 */
  const axesHelper = new THREE.AxesHelper(5);
  scene.add(axesHelper);

  /** 轨道控制器 */
  const controls = new OrbitControls(mainCamera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 0, 0);

  return { controls };
}
export const makeOrbit = (scene: THREE.Scene) => {

  const orbitGeometry = new THREE.RingGeometry(
    staticConfig.radius - 0.05,
    staticConfig.radius + 0.1,
    128
  );
  const orbitMaterial = new THREE.MeshBasicMaterial({
    color: '#f7f7f7',
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.6
  });
  const orbit = new THREE.Mesh(orbitGeometry, orbitMaterial);
  orbit.rotation.x = Math.PI / 2;
  scene.add(orbit);

  return orbit;

};

/** 创建节气辅助球体 */
export const makeSolarTermsEarth = () => {
  const seasonGeometry = new THREE.SphereGeometry(earthRadius, 32, 32);
  const seasonMaterial = new THREE.MeshBasicMaterial({
    color: '#24758f',
    transparent: true,
    opacity: 0.2
  });

  return solarTerms.map(item => {
    const seasonMesh = new THREE.Mesh(seasonGeometry, seasonMaterial);
    seasonMesh.position.set(...getEarthCenterPos(item.angle));
    seasonMesh.userData = item;
    return seasonMesh;
  });
};

/** 根据角度计算地球中心位置 */
export const getEarthCenterPos = (angle: number, radius?: number): [number, number, number] => {
  const useRadis = radius || staticConfig.radius;
  return [
    Math.cos(angle) * useRadis,
    0, // 轨道平面为赤道面（Y=0）
    Math.sin(angle) * useRadis
  ];
};


/** 创建星空 */
export const makeStars = () => {
  const textureLoader = new THREE.TextureLoader();
  const texture = textureLoader.load(window.$$prefix + '/textures/star_07.png');
  const count = 1000;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count * 3; i++) {
    positions[i] = (Math.random() - 0.5) * staticConfig.radius * 2;
    colors[i] = Math.random() * 10;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.4,
    sizeAttenuation: true,
    color: '#ff88cc',
    transparent: true,
    alphaMap: texture,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true
  });

  const stars = new THREE.Points(geometry, material);

  return stars
};

/** 创建经纬线&极点&回归线标记 */
export const createDebugLatLonSphere = (earthRadius: number) => {
  const linesGroup = new THREE.Group();
  linesGroup.name = 'linesGroup';

  // 核心修改：用地球真实半径作为基准，而非硬编码1.5
  const baseSize = earthRadius;
  const distanceFromEarth = earthRadius * 0.01; // 距离地球表面5%半径（避免重叠）
  const actualRadius = baseSize + distanceFromEarth; // 经纬线半径=地球半径+小偏移

  // 纬线计算（基于实际半径）
  latitudes.forEach(latItem => {
    const latRad = THREE.MathUtils.degToRad(latItem.lat);
    const latRadius = actualRadius * Math.cos(latRad);
    const latYPos = actualRadius * Math.sin(latRad);

    const latLine = new THREE.Mesh(
      new THREE.RingGeometry(latRadius, latRadius + latItem.width, 128),
      new THREE.MeshBasicMaterial({
        color: latItem.color,
        side: THREE.DoubleSide,
        transparent: false,
        depthWrite: false // 避免遮挡地球
      })
    );
    latLine.position.y = latYPos;
    latLine.rotation.x = Math.PI / 2;
    latLine.name = `latitude-item-${latItem.lat}`;
    linesGroup.add(latLine);
  });

  // 经线计算（同上）
  longitudes.forEach((lonItem, index) => {
    const lonRad = THREE.MathUtils.degToRad(lonItem.lon);
    const meridian = new THREE.Mesh(
      new THREE.RingGeometry(0, actualRadius + earthRadius * 0.001, 128, 0, Math.PI),
      new THREE.MeshBasicMaterial({
        color: lonItem.color,
        side: THREE.DoubleSide,
        transparent: false,
        depthWrite: false
      })
    );
    meridian.rotation.z = Math.PI / 2;
    meridian.rotation.x = Math.PI;
    meridian.rotation.y = lonRad;
    meridian.position.z = 0.0001 * index; // 微小偏移避免线条重叠
    meridian.name = `longitude-item-${lonItem.lon}`;
    linesGroup.add(meridian);
  });

  // 极点标记（尺寸适配地球半径）
  const poleMarkerSize = earthRadius * 0.025; // 极点尺寸=地球半径的10%

  const northPoleMarker = new THREE.Mesh(
    new THREE.SphereGeometry(poleMarkerSize, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  northPoleMarker.position.y = actualRadius;
  northPoleMarker.name = 'north-pole-marker';
  linesGroup.add(northPoleMarker);


  const southPoleMarker = new THREE.Mesh(
    new THREE.SphereGeometry(poleMarkerSize, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  southPoleMarker.position.y = -actualRadius;
  southPoleMarker.name = 'south-pole-marker';
  linesGroup.add(southPoleMarker);

  // 应用自转轴倾斜（保留）
  linesGroup.rotation.x = obliquityRad;
  // 移除固定缩放1.2，避免再次放大
  // linesGroup.scale.set(1.2, 1.2, 1.2); 

  return linesGroup;
};

export const makeSunDirectCylinder = (): THREE.Mesh => {
  // 1. 圆柱几何体：radius（粗细）、height（初始长度，后续动态更新）、分段数
  const geometry = new THREE.CylinderGeometry(
    cylinderConfig.radius, // 顶部半径
    cylinderConfig.radius, // 底部半径（与顶部一致，确保是正圆柱）
    25, // 初始高度（后续根据太阳-直射点距离动态更新）
    cylinderConfig.radialSegments, // 径向平滑度
    1, // 高度分段（无需多段）
    false // 不闭合（避免两端遮挡太阳/地球）
  );

  // 2. 圆柱材质：与原线条材质属性一致（透明、不遮挡、橙色）
  const material = new THREE.MeshBasicMaterial({
    color: cylinderConfig.color,
    transparent: true,
    opacity: cylinderConfig.opacity,
    depthWrite: true, // 避免被地球遮挡
    side: THREE.DoubleSide,
  });

  // 3. 创建圆柱网格并添加到场景
  const cylinder = new THREE.Mesh(geometry, material);

  return cylinder;
};


/** 新增：计算当前直射点的地球表面坐标（局部坐标） */
export const makeCalculateDirectPointLocal = (directLat: number,
  earthRef: React.RefObject<THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial, THREE.Object3DEventMap> | null>,
  earthGroupRef: React.RefObject<THREE.Group<THREE.Object3DEventMap> | null>,
  earthRadiusRef: React.RefObject<number>): THREE.Vector3 => {
  if (!earthRef.current || !earthGroupRef.current) return new THREE.Vector3();

  // ① 地球实际半径（基于模型缩放比例，确保直射点在地球表面）
  const earthScale = earthRef.current.scale.x;

  const actualEarthRadius = earthRadiusRef.current * earthScale;

  // ② 直射纬度转弧度（考虑地球自转轴倾斜）
  const directLatRad = THREE.MathUtils.degToRad(directLat);
  const tiltRad = obliquityRad; // 黄赤交角（23.5°）

  // ③ 关键：计算地球局部坐标系中的直射点（考虑自转轴倾斜）
  // - 经度固定为0°（面向太阳的“正午”位置，确保直射点在白天）
  const lonRad = 0;
  // 先计算无倾斜时的坐标，再通过旋转矩阵应用自转轴倾斜
  const x = actualEarthRadius * Math.cos(directLatRad) * Math.cos(lonRad);
  const y = actualEarthRadius * Math.sin(directLatRad);
  const z = actualEarthRadius * Math.cos(directLatRad) * Math.sin(lonRad);

  // 应用自转轴倾斜（绕X轴旋转tiltRad角度）
  const tiltMatrix = new THREE.Matrix4().makeRotationX(tiltRad);
  const directPointLocal = new THREE.Vector3(x, y, z).applyMatrix4(tiltMatrix);

  return directPointLocal;
};

/** 新增：将经纬度转换为地球表面的3D坐标 */
export const latLonToPosition = (lat: number, lon: number, radius: number): THREE.Vector3 => {

  // 将经纬度转换为弧度（核心修正：theta计算和轴对应）
  const phi = THREE.MathUtils.degToRad(90 - lat); // 纬度：从北极(0°)到南极(180°)
  const theta = THREE.MathUtils.degToRad(-lon); // 经度：从本初子午线(0°)向东为正（原代码+180°导致方向颠倒）

  // 正确的球面→笛卡尔坐标映射（Three.js右手坐标系：X东、Z北、Y上）
  const x = radius * Math.sin(phi) * Math.cos(theta); // 经度→X轴（东向）
  const y = radius * Math.cos(phi); // 纬度→Y轴（北向，北极Y最大）
  const z = radius * Math.sin(phi) * Math.sin(theta); // 经度→Z轴（北向）

  return new THREE.Vector3(x, y, z);
};