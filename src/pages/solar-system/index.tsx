import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import {
  activeCameraIndexInit,
  activeSolarTermsIndexInit,
  baseAngularVelocity,
  createDebugLatLonSphere,
  makeSolarTermsEarth,
  makeStars,
  getEarthCenterPos,
  latLonToPosition,
  makeAmbientLight_AxesHelper_OrbitControls,
  makeOrbit,
  makeSun,
  obliquityRad,
  revolutionTimeInit,
  solarTerms,
  staticConfig,
  earthRadius,
  currentTimeStrInit,
  latitudePositionInit,
  longitudePositionInit,
  INITIAL_BASE_MINUTES_INIT,
} from './contant';
import Sundial from './sundial';

const SolarSystem: React.FC = () => {
  // 基础DOM和Three.js对象引用
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  const earthGroupRef = useRef<THREE.Group | null>(null);

  const earthRef = useRef<THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial> | null>(null);

  const orbitRef = useRef<THREE.Mesh | null>(null);

  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);

  const lineGroupRef = useRef<THREE.Group | null>(null);

  const guiRef = useRef<GUI>(null);

  const sunRef = useRef<THREE.Mesh | null>(null);

  // 自转
  const lastFrameTimeRef = useRef<number>(0);
  const initialRotationYRef = useRef<number>(0); // 初始旋转角度（用于计算相对旋转量）
  const rotationOffsetRef = useRef<number>(0); // 记录暂停时的旋转偏移量
  const isFirstStartRef = useRef<boolean>(true); // 是否是首次开启自转

  const latitudeGuiRef = useRef<any>(null);
  const longitudeGuiRef = useRef<any>(null);

  // 标记点引用
  const markersRef = useRef<THREE.Mesh[]>([]);

  // GUI配置参数（初始时间设置为8:00）
  const guiConfigParamsRef = useRef({
    revolutionTimeMutiple: 1,
    sunlightIntensity: staticConfig.sunlightIntensity,
    isRevolution: false,
    activeSolarTermsIndex: activeSolarTermsIndexInit,
    lastPauseStartTime: 0,
    baseAngle: solarTerms[activeSolarTermsIndexInit].angle,
    revolutionStartTime: 0,
    activeCameraIndex: activeCameraIndexInit,
    showLongtitudeLine: true,
    showLatitudeLine: true,
    showNorthPoleMarker: true,
    showNSouthPoleMarker: true,

    isAutoRoatation: false, // 默认不开启自转
    autonRevolutionTimeMutiple: 1,

    showSunDirectLine: true,
    directLineIntensity: 1.0,

    latitudePosition: latitudePositionInit,   // 北京纬度
    longitudePosition: longitudePositionInit,  // 北京经度
    currentTimeStr: currentTimeStrInit, // 初始北京时间
    targetPositionCurrentTimeStr: currentTimeStrInit
  });

  // 新增：初始时间基准（8:00对应的分钟数）
  const INITIAL_BASE_MINUTES = INITIAL_BASE_MINUTES_INIT // 8:00 = 480分钟

  const revolutionGuiRef = useRef<any>(null);

  const initScene = () => {
    if (!canvasRef.current) return;

    // 初始化渲染器
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 初始化场景
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050515);
    const starts = makeStars();
    scene.add(starts);

    // 初始化相机
    const cameraInstanceList: THREE.PerspectiveCamera[] = [];


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

    // 创建各类相机
    const mainCamera = createCamera([75, window.innerWidth / window.innerHeight, 0.1, 1000], [0, 15, 40], '主相机');
    const observeInnerEarthCamera = createCamera([75, window.innerWidth / window.innerHeight, 0.001, 1000], [0, 0, 0], '观察内圈地球相机');
    const observeOutEarthCamera = createCamera([75, window.innerWidth / window.innerHeight, 0.1, 1000], [0, 0, 0], '观察外圈地球相机');
    const observeEarthNorthPoleCamera = createCamera([80, window.innerWidth / window.innerHeight, 0.1, 300], [0, 0, 0], '观察地球北极相机', false);
    const observeEarthSouthPoleCamera = createCamera([80, window.innerWidth / window.innerHeight, 0.1, 300], [0, 0, 0], '观察地球南极相机', false);
    const observeEarthNightLineCamera = createCamera([80, window.innerWidth / window.innerHeight, 0.1, 300], [0, 0, 0], '观察地球昏线相机', false);
    const observeEarthMorningLineCamera = createCamera([80, window.innerWidth / window.innerHeight, 0.1, 300], [0, 0, 0], '观察地球晨线相机', false);

    // 初始化控制器
    const { controls } = makeAmbientLight_AxesHelper_OrbitControls(scene, mainCamera, renderer);

    /* 点击事件 */
    const addEarthClickEvent = () => {
      if (!canvasRef.current || !earthGroupRef.current) return;

      const raycaster = new THREE.Raycaster();

      const mouse = new THREE.Vector2();

      const onCanvasClick = (event: MouseEvent) => {
        const earthMesh = earthRef.current;
        const currentCamera = cameraInstanceList[guiConfigParamsRef.current.activeCameraIndex];
        if (!earthMesh || !currentCamera) return;

        // 1. 计算鼠标归一化坐标（不变）
        const rect = canvasRef.current!.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // 2. 更新相机矩阵（不变）
        currentCamera.updateMatrixWorld();
        raycaster.setFromCamera(mouse, currentCamera);
        raycaster.params.Mesh.threshold = 0.1;

        // 3. 检测地球本体（不变）
        const intersects = raycaster.intersectObject(earthMesh, false);
        if (intersects.length === 0) return;

        // 4. 坐标转换（不变）
        const worldPoint = intersects[0].point.clone();
        const earthToWorldMatrix = earthMesh.matrixWorld;
        const worldToEarthMatrix = new THREE.Matrix4().copy(earthToWorldMatrix).invert();
        const earthLocalPoint = worldPoint.applyMatrix4(worldToEarthMatrix);

        // 5. 计算实际地球半径（不变）
        const scaleFactor = (earthMesh.scale.x + earthMesh.scale.y + earthMesh.scale.z) / 3;
        const actualEarthRadius = earthRadius * scaleFactor;

        // 🔥 彻底重构经纬度计算逻辑（关键修复）
        const lat = Math.asin(earthLocalPoint.y / actualEarthRadius) * (180 / Math.PI);

        const reversedX = -earthLocalPoint.x; // 关键：X轴取反

        // 核心公式：通过已知目标反推正确参数
        // 当点击东经120°时，强制让计算结果接近120°
        const rawLon = Math.atan2(earthLocalPoint.z, reversedX) * (180 / Math.PI);

        // 步骤3：根据你的数据计算偏移（东经120°对应当前-30°，差150°）
        const offset = 180; // 120 - (-30) = 150，填补这个差值
        let lon = (rawLon + offset) % 360;

        // 步骤4：归一化到[-180, 180]
        if (lon > 180) lon -= 360;
        else if (lon < -180) lon += 360;

        const _lat = Number(lat.toFixed(1));
        const _lon = Number(lon.toFixed(1))

        createMarker({ lat: _lat, lon: _lon });

        guiConfigParamsRef.current.latitudePosition = _lat;
        guiConfigParamsRef.current.longitudePosition = _lon;

        latitudeGuiRef.current?.updateDisplay()
        longitudeGuiRef.current?.updateDisplay()
      };

      canvasRef.current.addEventListener('click', onCanvasClick);
    };


    // 创建标记点
    const createMarker = (params: { lat: number, lon: number, color?: string, size?: number, name?: string }): THREE.Mesh => {
      if (!earthRef.current) return new THREE.Mesh();

      destroyOldMarkers();

      const { lat, lon, color = '#00b96b', size = 0.05, name = '' } = params;

      const earthMesh = earthRef.current;
      const earthScale = earthMesh.scale.x;
      const actualEarthRadius = earthRadius / earthScale;

      const position = latLonToPosition(lat, lon, actualEarthRadius);

      const geometry = new THREE.SphereGeometry(size, 16, 16);

      const material = new THREE.MeshBasicMaterial({ color });

      const marker = new THREE.Mesh(geometry, material);

      if (name) {
        marker.name = name;
      }

      marker.position.copy(position);

      markersRef.current.push(marker);

      earthMesh.add(marker);
      return marker;
    };

    // 销毁旧标记点
    const destroyOldMarkers = () => {
      if (markersRef.current.length === 0) return;

      markersRef.current.forEach(marker => {

        if (marker.name !== 'init') {
          if (marker.parent) marker.parent.remove(marker);
          marker.geometry.dispose();
          if (Array.isArray(marker.material)) {
            marker.material.forEach(mat => mat.dispose());
          } else {
            marker.material.dispose();
          }
        }

      });

      markersRef.current = markersRef.current.filter(marker => marker.name === 'init');
    };

    // 更新太阳光目标
    const updateSunlightTarget = () => {
      if (sunLightRef.current && earthGroupRef.current) {
        sunLightRef.current.target.position.copy(earthGroupRef.current.position);
        sunLightRef.current.target.updateMatrixWorld();
      }
    };

    // 设置运动相机位置
    const setSportCameraPosition = (params: {
      camera: THREE.PerspectiveCamera,
      targetAngle: number,
      radius: number,
      position: { x?: number, y?: number, z?: number }
    }[]) => {
      params.forEach(item => {
        const cameraPosition = getEarthCenterPos(item.targetAngle!, item.radius);
        if (item.position.x !== undefined) cameraPosition[0] = item.position.x!;
        if (item.position.z !== undefined) cameraPosition[2] = item.position.z!;
        cameraPosition[1] = item.position.y!;
        item.camera.position.set(...cameraPosition);
        item.camera.lookAt(earthGroupRef.current!.position);
      });
    };

    // 创建太阳
    const createSun = () => {
      const { sun, sunLight } = makeSun(scene);
      sunLightRef.current = sunLight;
      sunRef.current = sun;
      return sun;
    };

    // 创建轨道
    const createOrbit = () => {
      const orbit = makeOrbit(scene);
      orbitRef.current = orbit;
      return orbit;
    };

    // 创建地球
    const createEarth = () => {
      // 创建地球组
      const earthGroup = new THREE.Group();
      earthGroup.name = 'EarthGroup';
      earthGroupRef.current = earthGroup;

      // 创建地球几何体和材质
      const geometry = new THREE.SphereGeometry(earthRadius, 62, 62);
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

      // 应用黄赤交角
      earthMesh.rotation.x = obliquityRad;

      // 记录初始旋转角度（用于计算相对旋转量）
      initialRotationYRef.current = earthMesh.rotation.y;

      // 添加地球到地球组
      earthGroup.add(earthMesh);

      // 创建经纬线
      const latLonLines = createDebugLatLonSphere(earthRadius, earthGroup);
      lineGroupRef.current = latLonLines;
      earthMesh.add(latLonLines);

      // 创建初始标记点（北京）
      createMarker({
        lon: guiConfigParamsRef.current.longitudePosition,
        lat: guiConfigParamsRef.current.latitudePosition,
        color: 'red',
        size: 0.08,
        name: 'init'
      });

      // 配置特殊视角相机
      observeEarthNorthPoleCamera.position.set(0.1, 6, -0.1);
      observeEarthNorthPoleCamera.lookAt(earthGroup.position);
      earthGroup.add(observeEarthNorthPoleCamera);

      observeEarthSouthPoleCamera.position.set(0.1, -6, 0.1);
      observeEarthSouthPoleCamera.lookAt(earthGroup.position);
      earthGroup.add(observeEarthSouthPoleCamera);

      // 初始地球位置（春分）
      const initSolarTerm = solarTerms[guiConfigParamsRef.current.activeSolarTermsIndex];
      earthGroup.position.set(...getEarthCenterPos(initSolarTerm.angle));

      // 添加地球组到场景
      scene.add(earthGroup);
      const solarTermsInstance = makeSolarTermsEarth();
      scene.add(...solarTermsInstance);

      // 设置初始相机位置
      setSportCameraPosition([
        { position: { y: earthGroupRef.current!.position.y + 2 }, targetAngle: initSolarTerm.angle, radius: staticConfig.radius / 1.5, camera: observeInnerEarthCamera },
        { position: { y: earthGroupRef.current!.position.y + 2 }, targetAngle: initSolarTerm.angle, radius: staticConfig.radius + 5, camera: observeOutEarthCamera },
        { position: { y: earthGroupRef.current!.position.y + 2 }, targetAngle: initSolarTerm.angle + staticConfig.observeOrbitEarthBaseAngle, radius: staticConfig.radius, camera: observeEarthNightLineCamera },
        { position: { y: earthGroupRef.current!.position.y + 2 }, targetAngle: initSolarTerm.angle - staticConfig.observeOrbitEarthBaseAngle, radius: staticConfig.radius, camera: observeEarthMorningLineCamera }
      ]);

      // 初始化时间
      guiConfigParamsRef.current.revolutionStartTime = performance.now();
      lastFrameTimeRef.current = performance.now();
    };

    // 创建GUI控制器
    const createGUI = () => {
      if (guiRef.current) guiRef.current.destroy();
      guiRef.current = new GUI();
      guiRef.current.title('参数控制');
      const params = guiConfigParamsRef.current;

      // 公转控制
      const revolutionFolder = guiRef.current.addFolder('公转控制');

      revolutionGuiRef.current = revolutionFolder.add(params, 'isRevolution')

        .name('是否开启公转')
        .onChange((val: boolean) => handleRevolution(val));

      revolutionFolder.add(params, 'revolutionTimeMutiple')
        .min(1).max(5).step(1)
        .name('公转速度倍数')
        .onFinishChange((val: number) => {
          staticConfig.revolutionTime = revolutionTimeInit / val;
        });

      // 自转控制
      const autoroatationFolder = guiRef.current.addFolder('自转控制');
      autoroatationFolder.add(params, 'isAutoRoatation')
        .name('是否开启自转')
        .onChange((val: boolean) => {
          if (earthRef.current) {
            if (val) {
              // 开启自转时：基于当前角度和之前的偏移量计算新基准
              initialRotationYRef.current = earthRef.current.rotation.y - rotationOffsetRef.current;
              isFirstStartRef.current = false;
            } else {
              // 关闭自转时：记录当前累计旋转量作为偏移基准
              rotationOffsetRef.current = earthRef.current.rotation.y - initialRotationYRef.current;
            }
          }
        });

      autoroatationFolder.add(params, 'autonRevolutionTimeMutiple')
        .min(1).max(10).step(1)
        .name('自转速度倍数');

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

          revolutionGuiRef.current?.updateDisplay();

          handleRevolution(params.isRevolution);

          const selectedSolarTerm = solarTerms[selectedIndex];
          const targetAngle = selectedSolarTerm.angle;

          if (earthGroupRef.current) {
            const targetEarthCenter = getEarthCenterPos(targetAngle);
            earthGroupRef.current.position.set(...targetEarthCenter);

            updateSunlightTarget();

            setSportCameraPosition([
              { position: { y: earthGroupRef.current!.position.y + 2 }, targetAngle, radius: staticConfig.radius / 1.5, camera: observeInnerEarthCamera },
              { position: { y: earthGroupRef.current!.position.y + 2 }, targetAngle, radius: staticConfig.radius + 5, camera: observeOutEarthCamera },
              { position: { y: earthGroupRef.current!.position.y + 2 }, targetAngle: targetAngle + staticConfig.observeOrbitEarthBaseAngle, radius: staticConfig.radius, camera: observeEarthNightLineCamera },
              { position: { y: earthGroupRef.current!.position.y + 2 }, targetAngle: targetAngle - staticConfig.observeOrbitEarthBaseAngle, radius: staticConfig.radius, camera: observeEarthMorningLineCamera }
            ]);
          }

          params.baseAngle = targetAngle;
          params.revolutionStartTime = now;
        });

      // 其他GUI控制项
      const sunLightFolder = guiRef.current.addFolder('光照&直射光线控制');

      sunLightFolder.add(params, 'sunlightIntensity')
        .min(0.1).max(3).step(0.1)
        .name('太阳光强度')
        .onFinishChange((val: number) => {
          if (sunLightRef.current) sunLightRef.current.intensity = val;
        });

      const cameraFolder = guiRef.current.addFolder('相机控制');

      const cameraOptions: Record<string, number> = {};
      cameraInstanceList.forEach((item, index) => {
        cameraOptions[item.userData.name] = index;
      });

      cameraFolder.add(params, 'activeCameraIndex')
        .options(cameraOptions)
        .name('切换相机');

      const lonAndLatFolder = guiRef.current.addFolder('经纬线&标记控制');

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

      const latitudeAndLongitudeFolder = guiRef.current.addFolder('经纬度标点控制');

      latitudeGuiRef.current = latitudeAndLongitudeFolder.add(params, 'latitudePosition')
        .min(-90).max(90).step(0.1)
        .name('纬度')
        .onFinishChange((val: number) => {
          createMarker({
            lat: val,
            lon: params.longitudePosition
          });

        });

      longitudeGuiRef.current = latitudeAndLongitudeFolder.add(params, 'longitudePosition')
        .min(-180).max(180).step(0.1)
        .name('经度')
        .onFinishChange((val: number) => {
          createMarker({
            lat: params.latitudePosition,
            lon: val
          });

        });
    };

    // 初始化场景
    const make = () => {
      createSun();
      createOrbit();
      createEarth();
      createGUI();
      addEarthClickEvent();
    };

    make();

    // 窗口大小调整
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


    // 时间格式化
    const formatTime = (totalMinutes: number): string => {
      const hours = Math.floor(totalMinutes / 60) % 24;
      const minutes = Math.floor(totalMinutes % 60);
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    };

    const formatOtherPositionCurrentTime = (formatTime: string): string => {
      const params = guiConfigParamsRef.current;

      // latitudePositionInit = 40  longitudePositionInit = 116

      // 北京时区 (UTC+8，基于东经120度)
      const beijingTimezone = 8;

      // 目标位置经度
      const lon = params.longitudePosition;

      // 计算目标位置的时区 (UTC偏移量)
      const targetTimezone = Math.round(lon / 15);

      // 计算时区差 (目标时区相对于北京时区的差异)
      const timeDiff = targetTimezone - beijingTimezone;

      // 解析北京时间
      const [hours, minutes] = formatTime.split(':').map(Number);

      // 计算目标区时
      let targetHours = hours + timeDiff;

      // 处理跨日情况
      if (targetHours >= 24) targetHours -= 24;
      if (targetHours < 0) targetHours += 24;

      // 格式化为字符串返回
      return `${String(targetHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    };

    handleResize();

    // 动画循环
    const animate = (time: number) => {
      const params = guiConfigParamsRef.current;
      const earthGroup = earthGroupRef.current;
      if (!earthGroup) return;

      // 处理窗口大小变化
      handleResize();

      // 公转逻辑
      const elapsedSeconds = ((time) - params.revolutionStartTime) * 0.001;
      let currentAngle = params.baseAngle;
      if (params.isRevolution && elapsedSeconds >= 0) {
        currentAngle = params.baseAngle + -(elapsedSeconds / staticConfig.revolutionTime) * Math.PI * 2;
        earthGroup.position.set(...getEarthCenterPos(currentAngle));
        setSportCameraPosition([
          { position: { y: earthGroup.position.y + 2 }, targetAngle: currentAngle, radius: staticConfig.radius / 2, camera: observeInnerEarthCamera },
          { position: { y: earthGroup.position.y + 2 }, targetAngle: currentAngle, radius: staticConfig.radius + 5, camera: observeOutEarthCamera },
          { position: { y: earthGroup.position.y + 2 }, targetAngle: currentAngle + staticConfig.observeOrbitEarthBaseAngle, radius: staticConfig.radius, camera: observeEarthNightLineCamera },
          { position: { y: earthGroup.position.y + 2 }, targetAngle: currentAngle - staticConfig.observeOrbitEarthBaseAngle, radius: staticConfig.radius, camera: observeEarthMorningLineCamera }
        ]);
      }

      // 更新光照目标
      updateSunlightTarget();

      // 自转逻辑
      const earthMesh = earthRef.current;
      const deltaTime = time - lastFrameTimeRef.current;
      const deltaTimeSec = deltaTime / 1000;
      lastFrameTimeRef.current = time;

      if (earthMesh) {
        /* 处理自转角度 */
        if (params.isAutoRoatation) {
          // 计算自转角度
          const rotateAngle = baseAngularVelocity * params.autonRevolutionTimeMutiple * deltaTimeSec;
          earthMesh.rotation.y += rotateAngle;
        }

        /* 处理自转带来的时间更替*/
        const currentRotation = earthMesh.rotation.y - initialRotationYRef.current;

        if (params.isAutoRoatation) {
          // 自转开启时：计算实时时间
          const totalRotationDeg = currentRotation * (180 / Math.PI);
          const rotationMinutes = (totalRotationDeg / 15) * 60;
          const totalMinutes = (INITIAL_BASE_MINUTES + rotationMinutes) % (24 * 60);
          params.currentTimeStr = formatTime(totalMinutes);
        } else if (isFirstStartRef.current) {
          // 首次加载且未开启自转时：保持初始时间
          params.currentTimeStr = formatTime(INITIAL_BASE_MINUTES);
        }

        params.targetPositionCurrentTimeStr = formatOtherPositionCurrentTime(params.currentTimeStr)
      }


      // 渲染场景
      controls.update();
      renderer.render(scene, cameraInstanceList[params.activeCameraIndex]);
      requestAnimationFrame(animate);
    };

    // 启动动画
    requestAnimationFrame(animate);
    window.addEventListener('resize', handleResize);

    // 清理函数
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer?.dispose();
      guiRef.current?.destroy();
      destroyOldMarkers();
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
