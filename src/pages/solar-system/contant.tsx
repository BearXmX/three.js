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
export const autoRevolutionTimeInit = (revolutionTimeInit / 365) * 100; // 0.1秒/圈 * 50 = 5s一圈

// 新增：自转相关计算参数
export const baseAngularVelocity = (2 * Math.PI) / autoRevolutionTimeInit; // 基础角速度(rad/s) 5s转一圈

export const latitudePositionInit = 40   // 北京纬度
export const longitudePositionInit = 116  // 北京经度
/* export const longitudePositionTimeInit = 120  // 北京区时 */
export const currentTimeStrInit = '08:00'   // 初始北京时间

// 新增：初始时间基准（8:00对应的分钟数）
export const INITIAL_BASE_MINUTES_INIT = 8 * 60; // 8:00 = 480分钟


// 节气配置（包含直射纬度）
export const solarTerms = [
  { name: '春分', angle: 0, directLat: 0 },               // 春分：右侧（0°）
  { name: '夏至', angle: -Math.PI / 2, directLat: obliquity }, // 夏至：上方（-90°，即270°）
  { name: '秋分', angle: -Math.PI, directLat: 0 },        // 秋分：左侧（-180°）
  { name: '冬至', angle: -Math.PI * 3 / 2, directLat: -obliquity } // 冬至：下方（-270°，即90°）
];

// 纬线
export const latitudes = [
  { lat: 0, color: '#ff1030', width: 0.06 },     // 赤道
  { lat: obliquity, color: '#f5f500', width: 0.03 }, // 北回归线
  { lat: 30, color: '#f5f500', width: 0.03 },
  { lat: 60, color: '#f5f500', width: 0.03 },
  { lat: -obliquity, color: '#f5f500', width: 0.03 },// 南回归线
  { lat: -30, color: '#f5f500', width: 0.03 },
  { lat: -60, color: '#f5f500', width: 0.03 },
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
  observeOrbitEarthBaseAngle: Math.PI / 10,
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

  sunLight.position.z = -5

  scene.add(sun);

  const initSolarTerm = solarTerms[activeSolarTermsIndexInit];

  sunLight.target.position.set(      // 初始地球位置（春分）
    ...getEarthCenterPos(initSolarTerm.angle))

  return {
    sun,
    sunLight
  }
};

export const makeAmbientLight_AxesHelper_OrbitControls = (scene: THREE.Scene, mainCamera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) => {
  /** 灯光 */
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.05);
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
  const seasonGeometry = new THREE.SphereGeometry(earthRadius / 2, 32, 32);
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
export const createDebugLatLonSphere = (earthRadius: number, earthGroup: THREE.Group) => {
  const linesGroup = new THREE.Group();
  linesGroup.name = 'linesGroup';

  // 基准参数（与地球保持微小距离，避免重叠）
  const baseSize = earthRadius;
  const distanceFromEarth = earthRadius * 0.008;
  const actualRadius = baseSize + distanceFromEarth;

  // 关键：让经纬线组整体继承地球的倾斜角度（与地球自转轴一致）
  // 这样纬线平面会与地球赤道平面平行，角度正确

  // ---------------------- 纬线修复 ----------------------
  latitudes.forEach(latItem => {
    const latDeg = latItem.lat;
    const latRad = THREE.MathUtils.degToRad(latDeg);
    const obliquityRad = THREE.MathUtils.degToRad(obliquity); // 黄赤交角（弧度）

    // 1. 基础尺寸（与地球半径严格绑定）
    const radius = earthRadius;
    const gap = radius * 0.002; // 贴近地球表面的间隙
    const ringRadius = radius + gap;

    // 2. 核心：三维位置计算（完整补偿旋转后的坐标系偏移）
    // 纬度对应的径向距离（垂直于自转轴的半径）
    const latitudeCircleRadius = ringRadius * Math.cos(latRad);
    // 纬度对应的轴向距离（沿自转轴的距离，北纬为正，南纬为负）
    const axialDistance = ringRadius * Math.sin(latRad);

    // 3. 计算旋转后的实际位置（关键修复）
    // 地球自转轴倾斜后，沿自转轴的点在世界坐标系中会同时有Y和Z分量
    const yPosition = axialDistance * Math.cos(obliquityRad); // Y轴分量
    const zPosition = axialDistance * Math.sin(obliquityRad); // Z轴分量（之前缺失的部分）

    // 4. 创建纬线圈
    const latLine = new THREE.Mesh(
      new THREE.RingGeometry(
        latitudeCircleRadius,
        latitudeCircleRadius + latItem.width,
        128
      ),
      new THREE.MeshBasicMaterial({
        color: latItem.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
        depthWrite: false
      })
    );

    // 5. 位置与旋转（匹配你的正确角度）
    latLine.position.set(0, yPosition, zPosition); // 同时设置Y和Z

    latLine.rotation.x = THREE.MathUtils.degToRad(obliquity - 90); // 保持你确认的正确角度

    // 6. 确保与地球同中心
    latLine.matrixAutoUpdate = true;
    latLine.updateMatrix();

    earthGroup.add(latLine);
  });

  // ---------------------- 经线修复 ----------------------
  longitudes.forEach((lonItem, index) => {
    const lonRad = THREE.MathUtils.degToRad(lonItem.lon);

    // 创建经线圈（半圆环，覆盖南北极）
    const meridian = new THREE.Mesh(
      new THREE.RingGeometry(0, actualRadius + earthRadius * 0.0005, 128, 0, Math.PI),
      new THREE.MeshBasicMaterial({
        color: lonItem.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
        depthWrite: false
      })
    );

    // 经线旋转：使其从默认平面转为沿经线方向
    meridian.rotation.z = Math.PI / 2;
    meridian.rotation.x = Math.PI;
    meridian.rotation.y = lonRad; // 沿经度旋转
    meridian.position.z = 0.0001 * index; // 微小偏移避免重叠
    meridian.name = `longitude-item-${lonItem.lon}`;

    linesGroup.add(meridian);
  });

  // ---------------------- 极点标记 ----------------------
  const poleMarkerSize = earthRadius * 0.025;
  // 北极点
  const northPoleMarker = new THREE.Mesh(
    new THREE.SphereGeometry(poleMarkerSize, 16, 16),
    new THREE.MeshBasicMaterial({ color: 'red' })
  );
  northPoleMarker.position.y = actualRadius;
  northPoleMarker.name = 'north-pole-marker';
  linesGroup.add(northPoleMarker);

  // 南极点
  const southPoleMarker = new THREE.Mesh(
    new THREE.SphereGeometry(poleMarkerSize, 16, 16),
    new THREE.MeshBasicMaterial({ color: 'red' })
  );
  southPoleMarker.position.y = -actualRadius;
  southPoleMarker.name = 'south-pole-marker';
  linesGroup.add(southPoleMarker);

  // 关键：将经纬线组添加到地球的父级（如scene），而非earthGroup
  // 这样经纬线不会跟随earthGroup自转（如果earthGroup有自转逻辑）
  // 示例：scene.add(linesGroup); 而非 earthGroup.add(linesGroup);

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