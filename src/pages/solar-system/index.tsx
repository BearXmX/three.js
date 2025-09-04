import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BooleanController, GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import {
  activeCameraIndexInit,
  activeSolarTermsIndexInit,
  baseAngularVelocity,
  createDebugLatLonSphere,
  makeSolarTermsEarth,
  makeStars,
  cylinderConfig,
  getEarthCenterPos,
  latitudes,
  latLonToPosition,
  longitudes,
  makeAmbientLight_AxesHelper_OrbitControls,
  makeCalculateDirectPointLocal,
  makeOrbit,
  makeSun,
  makeSunDirectCylinder,
  obliquity,
  obliquityRad,
  revolutionTimeInit,
  solarTerms,
  staticConfig,
  sunRadius,
  earthRadius
} from './contant';
import Sundial from './sundial';

const SolarSystem: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const earthGroupRef = useRef<THREE.Group | null>(null);
  const earthRef = useRef<THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial, THREE.Object3DEventMap> | null>(null);
  const orbitRef = useRef<THREE.Mesh | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const lineGroupRef = useRef<THREE.Group | null>(null);
  const guiRef = useRef<GUI>(null);
  const sunPositionRef = useRef<THREE.Vector3>(new THREE.Vector3(2, 0, 0));
  const sunRef = useRef<THREE.Mesh | null>(null);

  const earthRadiusRef = useRef<number>(earthRadius);

  // 新增：太阳直射光线相关引用
  const sunDirectCylinderRef = useRef<THREE.Mesh | null>(null); // 新增圆柱引用

  const directPointRef = useRef<THREE.Vector3>(new THREE.Vector3()); // 直射点坐标（地球表面）
  const currentDirectLatRef = useRef<number>(0); // 当前直射纬度（实时更新，用于过渡）
  const targetDirectLatRef = useRef<number>(0); // 目标直射纬度（节气切换时使用）
  const isDirectLatTransitionRef = useRef<boolean>(false); // 是否处于直射纬度过渡中
  const transitionStartTimeRef = useRef<number>(0); // 过渡开始时间
  const transitionDuration = 1000; // 过渡时长（ms），1秒平滑过渡

  const lastFrameTimeRef = useRef<number>(0); // 上一帧时间，用于计算时间差

  // GUI 配置参数
  const guiConfigParamsRef = useRef({
    revolutionTimeMutiple: 1,
    sunlightIntensity: staticConfig.sunlightIntensity,
    isRevolution: true,
    activeSolarTermsIndex: activeSolarTermsIndexInit,
    lastPauseStartTime: 0,
    baseAngle: solarTerms[activeSolarTermsIndexInit].angle,
    revolutionStartTime: 0,

    activeCameraIndex: activeCameraIndexInit,

    showLongtitudeLine: true,
    showLatitudeLine: true,
    showNorthPoleMarker: true,
    showNSouthPoleMarker: true,

    isAutoRoatation: false,
    autonRevolutionTimeMutiple: 1, // 自转倍速

    showSunDirectLine: true,
    directLineIntensity: 1.0,

    latitudePosition: 31,
    longitudePosition: 121
  });

  const revolutionGuiRef = useRef<BooleanController<{ isRevolution: boolean }>>(null);

  // 首先确保markersRef是数组类型，用于存储所有标记点引用
  const markersRef = useRef<THREE.Mesh[]>([]); // 修正：用数组存储所有标记点

  const initScene = () => {
    if (!canvasRef.current) return;

    /** 渲染器 */
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true
    });

    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    /** 场景 */
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050515);

    /* 星空 */
    const starts = makeStars();
    scene.add(starts)

    /** 相机 */
    const cameraInstanceList = [] as THREE.PerspectiveCamera[];

    const createCamera = (
      base: [fov: number, aspect: number, near: number, far: number],
      position: [x: number, y: number, z: number],
      name: string,
      addToScene = true
    ) => {
      const camera = new THREE.PerspectiveCamera(...base);
      camera.position.set(...position);
      camera.lookAt(0, 0, 0);
      camera.userData.name = name;
      cameraInstanceList.push(camera);
      if (addToScene) scene.add(camera);
      return camera;
    };

    const mainCamera = createCamera([75, window.innerWidth / window.innerHeight, 0.1, 1000], [0, 15, 50], '主相机');
    const observeInnerEarthCamera = createCamera([75, window.innerWidth / window.innerHeight, 0.001, 1000], [0, 0, 0], '观察内圈地球相机');
    const observeOutEarthCamera = createCamera([75, window.innerWidth / window.innerHeight, 0.1, 1000], [0, 0, 0], '观察外圈地球相机');
    const observeEarthNorthPoleCamera = createCamera([80, window.innerWidth / window.innerHeight, 0.1, 300], [0, 0, 0], '观察地球北极相机', false);
    const observeEarthSouthPoleCamera = createCamera([80, window.innerWidth / window.innerHeight, 0.1, 300], [0, 0, 0], '观察地球南极相机', false);
    const observeOrbitEarthCamera = createCamera([80, window.innerWidth / window.innerHeight, 0.1, 300], [0, 0, 0], '观察轨道地球相机', false);


    const { controls } = makeAmbientLight_AxesHelper_OrbitControls(scene, mainCamera, renderer)

    /** 新增：在地球上创建标记点 */
    const createMarker = (lat: number, lon: number, color: string = '#00b96b', size: number = 0.05): THREE.Mesh => {
      if (!earthRef.current) return new THREE.Mesh();

      // 第一步：先销毁所有旧标记点
      destroyOldMarkers();

      // 核心修复：获取地球模型实际缩放
      const earthMesh = earthRef.current;
      const earthScale = earthMesh.scale.x;
      const actualEarthRadius = earthRadiusRef.current / earthScale;

      // 计算标记点位置
      const position = latLonToPosition(lat, lon, actualEarthRadius);

      // 标记点几何体和材质
      const geometry = new THREE.SphereGeometry(size, 16, 16);
      const material = new THREE.MeshBasicMaterial({ color });

      const marker = new THREE.Mesh(geometry, material);
      marker.position.copy(position);

      // 将新标记点添加到引用列表
      markersRef.current.push(marker);

      // 添加到地球模型下
      earthMesh.add(marker);

      return marker;
    };


    /** 新增：销毁所有旧标记点 */
    const destroyOldMarkers = () => {
      if (markersRef.current.length === 0) return;

      // 遍历所有旧标记点，移除并清理资源
      markersRef.current.forEach(marker => {
        // 从父节点移除（避免内存泄漏）
        if (marker.parent) {
          marker.parent.remove(marker);
        }
        // 销毁几何体和材质（释放GPU资源）
        marker.geometry.dispose();
        if (Array.isArray(marker.material)) {
          marker.material.forEach(mat => mat.dispose());
        } else {
          marker.material.dispose();
        }
      });

      // 清空引用列表
      markersRef.current = [];
    };

    /** 【修改2：创建太阳直射圆柱（替代原有线条）】 */
    const createSunDirectCylinder = (): THREE.Mesh => {
      const cylinder = makeSunDirectCylinder()

      scene.add(cylinder);

      return cylinder;
    };


    /** 新增：计算当前直射点的地球表面坐标（局部坐标） */
    const calculateDirectPointLocal = (directLat: number): THREE.Vector3 => {

      return makeCalculateDirectPointLocal(directLat, earthRef, earthGroupRef, earthRadiusRef);
    };

    /** 【修改3：更新太阳直射圆柱位置（替代原有线条更新逻辑）】 */
    const updateSunDirectCylinder = (time: number) => {
      const params = guiConfigParamsRef.current;
      if (!sunRef.current || !earthGroupRef.current || !sunDirectCylinderRef.current) return;

      // ---------------------- 1. 保留原有直射点计算（逻辑不变，确保节气/光照正确） ----------------------
      if (isDirectLatTransitionRef.current) {
        const elapsed = time - transitionStartTimeRef.current;
        const progress = Math.min(elapsed / transitionDuration, 1);
        currentDirectLatRef.current = THREE.MathUtils.lerp(
          currentDirectLatRef.current,
          targetDirectLatRef.current,
          progress
        );
        if (progress >= 1) {
          isDirectLatTransitionRef.current = false;
          currentDirectLatRef.current = targetDirectLatRef.current;
        }
      } else if (params.isRevolution) {
        const currentAngle = params.baseAngle + (time - params.revolutionStartTime) * 0.001 / staticConfig.revolutionTime * Math.PI * 2;
        const latRatio = -Math.cos(currentAngle);
        currentDirectLatRef.current = latRatio * obliquity;
      }
      // 仍需计算直射点（用于其他逻辑，不影响圆柱位置）
      const directPointLocal = calculateDirectPointLocal(currentDirectLatRef.current);
      const directPointWorld = directPointLocal.applyMatrix4(earthGroupRef.current.matrixWorld);
      directPointRef.current.copy(directPointWorld);

      // ---------------------- 2. 新逻辑：基于“太阳→地球中心”计算圆柱位置（核心修复） ----------------------
      // 2.1 获取关键坐标：太阳世界位置、地球中心世界位置
      const sunWorldPos = new THREE.Vector3();
      sunRef.current.getWorldPosition(sunWorldPos); // 太阳位置
      const earthCenterWorldPos = new THREE.Vector3();
      earthGroupRef.current.getWorldPosition(earthCenterWorldPos); // 地球中心位置（稳定参考点）

      // 2.2 计算“太阳→地球中心”的向量（稳定方向，不随直射点转动）
      const sunToEarthVec = new THREE.Vector3()
        .subVectors(earthCenterWorldPos, sunWorldPos) // 太阳指向地球中心的向量
        .normalize(); // 归一化（只保留方向）

      // 2.3 计算圆柱的起点和终点（确保在中间，不穿地球）
      const earthRadius = earthRadiusRef.current; // 地球半径

      const sunToEarthDistance = sunWorldPos.distanceTo(earthCenterWorldPos); // 太阳到地球中心的距离

      // 起点：从太阳向地球方向移动一段距离（避免紧贴太阳，视觉更自然）
      const cylinderStartPos = new THREE.Vector3()
        .copy(sunWorldPos)
        .addScaledVector(sunToEarthVec, sunRadius * 1); // 远离太阳（2倍太阳半径）

      // 终点：在地球表面外侧（避免穿透地球，始终在地球前方）
      const cylinderEndPos = new THREE.Vector3()
        .copy(earthCenterWorldPos)
        .addScaledVector(sunToEarthVec, earthRadius * 1); // 地球表面外5%（突出一点）

      // 2.4 计算圆柱的实际长度和中点（用于定位）
      const cylinderLength = cylinderStartPos.distanceTo(cylinderEndPos) / cylinderConfig.lengthScale; // 适配原缩放因子
      const cylinderCenterPos = new THREE.Vector3().lerpVectors(cylinderStartPos, cylinderEndPos, 0.5); // 圆柱中点（视觉居中）

      // ---------------------- 3. 应用到圆柱（更新位置、缩放、方向） ----------------------
      const cylinder = sunDirectCylinderRef.current;
      // 位置：圆柱中点（太阳与地球中间）
      cylinder.position.copy(cylinderCenterPos);
      // 缩放：长度适配计算结果，半径不变
      cylinder.scale.set(1, cylinderLength, 1);
      // 方向：对准终点（太阳→地球方向，稳定不偏）
      cylinder.lookAt(cylinderEndPos);
      cylinder.rotateX(Math.PI / 2); // 修正圆柱朝向（原逻辑保留）

      // 可见性控制（原逻辑保留）
      cylinder.visible = params.showSunDirectLine;
    };

    /** 设置运动相机位置 */
    const setSportCameraPosition = (params: {
      camera: THREE.PerspectiveCamera,
      targetAngle: number,
      radius: number,
      position: { x?: number, y?: number, z?: number }
    }[]) => {
      params.forEach(item => {
        const cameraPosition = getEarthCenterPos(item.targetAngle!, item.radius);

        if (item.position.x !== undefined) {
          cameraPosition[0] = item.position.x!;
        }

        if (item.position.z !== undefined) {
          cameraPosition[2] = item.position.z!;
        }

        cameraPosition[1] = item.position.y!;
        item.camera.position.set(...cameraPosition);
        item.camera.lookAt(earthGroupRef.current!.position);
      });
    };

    /** 创建太阳（初始化直射光线） */
    const createSun = () => {

      const { sun, sunLight } = makeSun(scene)

      sunLightRef.current = sunLight;
      sunPositionRef.current.copy(sun.position);
      sunRef.current = sun;

      // 【初始化直射圆柱（替代原有createSunDirectLine）】
      sunDirectCylinderRef.current = createSunDirectCylinder();
      // 初始直射纬度（春分：0°）
      currentDirectLatRef.current = solarTerms[activeSolarTermsIndexInit].directLat;
      targetDirectLatRef.current = currentDirectLatRef.current;

      return sun;
    };

    /** 创建轨道 */
    const createOrbit = () => {

      const orbit = makeOrbit(scene);

      orbitRef.current = orbit;

      return orbit;
    };

    const createEarth = () => {

      const earthGroup = new THREE.Group();

      earthGroup.name = 'EarthGroup';

      earthGroupRef.current = earthGroup;

      // 绘制几何图形
      const geometry = new THREE.SphereGeometry(earthRadiusRef.current, 62, 62);


      const textureLoader = new THREE.TextureLoader();

      const earthTexture = textureLoader.load(
        window.$$prefix + '/models/earth/textures/Material.002_diffuse.jpg'
      );

      const material = new THREE.MeshStandardMaterial({
        map: earthTexture,
        color: '#fff',
        side: THREE.DoubleSide,
      });

      const earthMesh = new THREE.Mesh(geometry, material);

      earthRef.current = earthMesh;

      // 地球自转轴倾斜（黄赤交角）
      earthMesh.rotation.x = obliquityRad;

      earthGroup.add(earthMesh);

      /* 创建经纬线和极点 */
      const latLonLines = createDebugLatLonSphere(earthRadiusRef.current);

      lineGroupRef.current = latLonLines;

      earthGroup.add(latLonLines);

      // 相机位置设置
      const observeEarthNorthPoleCameraPos = new THREE.Vector3(0.1, 6, -0.1);
      observeEarthNorthPoleCamera.position.copy(observeEarthNorthPoleCameraPos);
      observeEarthNorthPoleCamera.lookAt(earthGroup.position);
      earthGroup.add(observeEarthNorthPoleCamera);

      const observeEarthSouthPoleCameraPos = new THREE.Vector3(0.1, -6, 0.1);
      observeEarthSouthPoleCamera.position.copy(observeEarthSouthPoleCameraPos);
      observeEarthSouthPoleCamera.lookAt(earthGroup.position);
      earthGroup.add(observeEarthSouthPoleCamera);

      // 初始地球位置（春分）
      const initSolarTerm = solarTerms[guiConfigParamsRef.current.activeSolarTermsIndex];
      earthGroup.position.set(...getEarthCenterPos(initSolarTerm.angle));

      scene.add(earthGroup);

      const solarTermsInstance = makeSolarTermsEarth();

      scene.add(...solarTermsInstance);

      createMarker(guiConfigParamsRef.current.latitudePosition, guiConfigParamsRef.current.longitudePosition)

      // 初始化回归线连线

      guiConfigParamsRef.current.revolutionStartTime = performance.now();
      lastFrameTimeRef.current = performance.now(); // 初始化自转时间
    }

    /** 创建GUI */
    const createGUI = () => {
      if (guiRef.current) guiRef.current.destroy();

      guiRef.current = new GUI();
      guiRef.current.title('参数控制');
      const params = guiConfigParamsRef.current;

      // 公转控制
      const revolutionFolder = guiRef.current.addFolder('公转控制');

      // @ts-ignore
      revolutionGuiRef.current = revolutionFolder.add(params, 'isRevolution')
        .name('是否开启公转')
        .onChange((val: boolean) => {
          handleRevolution(val)
        });

      revolutionFolder.add(params, 'revolutionTimeMutiple')
        .min(1).max(5).step(1)
        .name('公转速度倍数')
        .onFinishChange((val: number) => {
          staticConfig.revolutionTime = revolutionTimeInit / val;
        });

      // 自转控制（只修改这部分）
      const autoroatationFolder = guiRef.current.addFolder('自转控制');

      // @ts-ignore
      autoroatationFolder.add(params, 'isAutoRoatation')
        .name('是否开启自转')
        .onChange((val: boolean) => {
          // 切换自转状态时重置时间，避免跳跃
          if (val) {
            lastFrameTimeRef.current = performance.now();
          }
        });

      autoroatationFolder.add(params, 'autonRevolutionTimeMutiple')
        .min(1).max(10).step(1)
        .name('自转速度倍数')
        .onFinishChange((val: number) => {
          // 仅更新倍数值，不改变其他逻辑
        });

      // 节气控制
      const solarTermsFolder = guiRef.current.addFolder('节气控制');

      const solarTermsOptions: Record<string, number> = {};
      solarTerms.forEach((item, index) => {
        solarTermsOptions[item.name] = index;
      });

      const handleRevolution = (val: boolean) => {
        const now = performance.now();
        const params = guiConfigParamsRef.current;

        if (!val) {
          const elapsed = ((now) - params.revolutionStartTime) * 0.001;
          const currentDynamicAngle = params.baseAngle + -(elapsed / staticConfig.revolutionTime) * Math.PI * 2;
          params.baseAngle = currentDynamicAngle;
          params.lastPauseStartTime = now;
        } else {
          params.revolutionStartTime = now;
        }
      };

      solarTermsFolder.add(params, 'activeSolarTermsIndex')
        .options(solarTermsOptions)
        .name('切换节气')
        .onChange((selectedIndex: any) => {
          const now = performance.now();
          const params = guiConfigParamsRef.current;

          params.isRevolution = false;

          revolutionGuiRef.current!.updateDisplay();

          handleRevolution(params.isRevolution);

          const selectedSolarTerm = solarTerms[selectedIndex];
          const targetAngle = selectedSolarTerm.angle;
          const targetDirectLat = selectedSolarTerm.directLat;

          // 更新地球位置
          if (earthGroupRef.current) {
            const targetEarthCenter = getEarthCenterPos(targetAngle);

            earthGroupRef.current.position.set(...targetEarthCenter);

            setSportCameraPosition([
              { position: { y: earthGroupRef.current!.position.y + 2 }, targetAngle, radius: staticConfig.radius / 2, camera: observeInnerEarthCamera },
              { position: { y: earthGroupRef.current!.position.y + 2 }, targetAngle, radius: staticConfig.radius + 5, camera: observeOutEarthCamera },
              { position: { y: earthGroupRef.current!.position.y + 2 }, targetAngle: targetAngle + staticConfig.observeOrbitEarthBaseAngle, radius: staticConfig.radius, camera: observeOrbitEarthCamera }
            ]);
          }

          // 触发直射纬度过渡
          isDirectLatTransitionRef.current = false;

          targetDirectLatRef.current = targetDirectLat; // 目标纬度

          transitionStartTimeRef.current = now; // 过渡开始时间

          // 立即更新直射光线位置
          if (sunDirectCylinderRef.current) {
            updateSunDirectCylinder(now);
          }

          params.baseAngle = targetAngle;
          params.revolutionStartTime = now;
        });

      // 光照&直射光线控制
      const sunLightFolder = guiRef.current.addFolder('光照&直射光线控制');
      sunLightFolder.add(params, 'sunlightIntensity')
        .min(0.1).max(3).step(0.1)
        .name('太阳光强度')
        .onFinishChange((val: number) => {
          if (sunLightRef.current) sunLightRef.current.intensity = val;
        });

      // 直射光线控制
      sunLightFolder.add(params, 'showSunDirectLine')
        .name('显示太阳直射光线')
        .onChange((val: boolean) => {
          if (sunDirectCylinderRef.current) sunDirectCylinderRef.current.visible = val;
        });

      // 相机控制
      const cameraFolder = guiRef.current.addFolder('相机控制');
      const cameraOptions: Record<string, number> = {};
      cameraInstanceList.forEach((item, index) => {
        cameraOptions[item.userData.name] = index;
      });

      cameraFolder.add(params, 'activeCameraIndex')
        .options(cameraOptions)
        .name('切换相机').onChange((val) => {

        });

      // 经纬线&标记&连线控制
      const lonAndLatFolder = guiRef.current.addFolder('经纬线&标记&连线控制');
      lonAndLatFolder.add(params, 'showLatitudeLine')
        .name('是否显示纬线')
        .onChange((val: boolean) => {
          if (lineGroupRef.current) {
            lineGroupRef.current.children.forEach(child => {
              if (child.name.includes('latitude-item')) child.visible = val;
            });
          }
        });

      lonAndLatFolder.add(params, 'showLongtitudeLine')
        .name('是否显示经线')
        .onChange((val: boolean) => {
          if (lineGroupRef.current) {
            lineGroupRef.current.children.forEach(child => {
              if (child.name.includes('longitude-item')) child.visible = val;
            });
          }
        });

      lonAndLatFolder.add(params, 'showNorthPoleMarker')
        .name('是否显示北极点')
        .onChange((val: boolean) => {
          const marker = lineGroupRef.current?.getObjectByName('north-pole-marker');
          if (marker) marker.visible = val;
        });

      lonAndLatFolder.add(params, 'showNSouthPoleMarker')
        .name('是否显示南极点')
        .onChange((val: boolean) => {
          const marker = lineGroupRef.current?.getObjectByName('south-pole-marker');
          if (marker) marker.visible = val;
        });

      // 经纬度标点控制
      const latitudeAndLongitudeFolder = guiRef.current.addFolder('经纬度标点控制');

      latitudeAndLongitudeFolder.add(params, 'latitudePosition')
        .min(-90).max(90).step(0.1)
        .name('纬度')
        .onFinishChange((val: number) => {
          createMarker(val, params.longitudePosition)
        });

      latitudeAndLongitudeFolder.add(params, 'longitudePosition')
        .min(-180).max(180).step(0.1)
        .name('经度')
        .onFinishChange((val: number) => {
          createMarker(params.latitudePosition, val)
        });
    };


    /** 初始化场景 */
    const make = () => {
      createSun();
      createOrbit();
      createEarth();
      createGUI();
    };

    make();

    /** 窗口调整 */
    const handleResize = () => {
      if (!canvasRef.current) return;
      const { clientWidth: width, clientHeight: height } = canvasRef.current;
      if (renderer.domElement.width !== width || renderer.domElement.height !== height) {
        renderer.setSize(width, height, false);
        cameraInstanceList.forEach((camera) => {
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        });
      }
    };

    handleResize();

    /** 动画循环（只修改自转相关部分） */
    const animate = (time: number) => {
      const params = guiConfigParamsRef.current;


      const elapsedSeconds = ((time) - params.revolutionStartTime) * 0.001;

      if (earthGroupRef.current && sunLightRef.current) {
        handleResize();

        // 1. 计算地球当前公转角度
        let currentAngle = params.baseAngle;
        if (params.isRevolution && elapsedSeconds >= 0) {
          currentAngle = params.baseAngle + -(elapsedSeconds / staticConfig.revolutionTime) * Math.PI * 2;
          earthGroupRef.current.position.set(...getEarthCenterPos(currentAngle));

          // 更新运动相机位置
          setSportCameraPosition([
            { position: { y: earthGroupRef.current!.position.y + 2 }, targetAngle: currentAngle, radius: staticConfig.radius / 2, camera: observeInnerEarthCamera },
            { position: { y: earthGroupRef.current!.position.y + 2 }, targetAngle: currentAngle, radius: staticConfig.radius + 5, camera: observeOutEarthCamera },
            { position: { y: earthGroupRef.current!.position.y + 2 }, targetAngle: currentAngle + staticConfig.observeOrbitEarthBaseAngle, radius: staticConfig.radius, camera: observeOrbitEarthCamera }
          ]);
        }

        // 2. 更新光照目标
        const normalizedAngle = (currentAngle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        const adjustedAngle = normalizedAngle + Math.PI / 2;
        const sinValue = Math.sin(adjustedAngle);
        const maxOffset = 1;
        const lightOffsetY = sinValue * maxOffset;

        sunLightRef.current.target.position.set(
          earthGroupRef.current.position.x,
          earthGroupRef.current.position.y,
          earthGroupRef.current.position.z
        );
        sunLightRef.current.target.updateMatrixWorld();

        // 3. 地球自转（只修改这部分逻辑）
        const earthMesh = earthRef.current;

        // 计算帧时间差（用于自转计算）

        const deltaTime = time - lastFrameTimeRef.current;

        const deltaTimeSec = deltaTime / 1000; // 转换为秒

        lastFrameTimeRef.current = time;

        if (earthMesh && params.isAutoRoatation) {
          // 计算当前帧应该旋转的角度

          // 基础角速度 × 倍速 × 时间差
          const rotateAngle = baseAngularVelocity * params.autonRevolutionTimeMutiple * deltaTimeSec;

          earthMesh.rotation.y += rotateAngle; // 自西向东旋转
        }


        // 【调用圆柱更新（替代原有updateSunDirectLine）】
        updateSunDirectCylinder(time);
      }

      controls.update();
      renderer.render(scene, cameraInstanceList[params.activeCameraIndex]);
      requestAnimationFrame(animate);
    };

    /** 启动动画 */
    requestAnimationFrame(animate);
    window.addEventListener('resize', handleResize);

    /** 清理 */
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer?.dispose();
      guiRef.current?.destroy();

    };
  };

  useEffect(() => {
    const cleanup = initScene();
    return cleanup;
  }, []);

  return (
    <div className='canvas-container' style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <canvas
        className='canvas-body'
        ref={canvasRef}
        style={{ width: '100%', height: '100%' }}
      ></canvas>

      <Sundial params={guiConfigParamsRef.current}></Sundial>
    </div>
  );
};

export default SolarSystem;
