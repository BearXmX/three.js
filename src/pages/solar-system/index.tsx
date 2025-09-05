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
  autoRevolutionTimeInit
} from './contant';
import Sundial from './sundial';

const SolarSystem: React.FC = () => {
  // 基础DOM和Three.js对象引用（保持不变）
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const earthGroupRef = useRef<THREE.Group | null>(null);
  const earthRef = useRef<THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial> | null>(null);
  const orbitRef = useRef<THREE.Mesh | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const lineGroupRef = useRef<THREE.Group | null>(null);
  const guiRef = useRef<GUI>(null);
  const sunPositionRef = useRef<THREE.Vector3>(new THREE.Vector3(2, 0, 0));
  const sunRef = useRef<THREE.Mesh | null>(null);

  // 地球参数引用（保持不变）
  const earthRadiusRef = useRef<number>(earthRadius);

  // 太阳直射相关引用（保持不变）
  const sunDirectCylinderRef = useRef<THREE.Mesh | null>(null);
  const currentDirectLatRef = useRef<number>(0);
  const targetDirectLatRef = useRef<number>(0);
  const isDirectLatTransitionRef = useRef<boolean>(false);
  const transitionStartTimeRef = useRef<number>(0);
  const transitionDuration = 1000; // 过渡动画时长（毫秒）

  // 时间和动画控制引用（保持不变）
  const lastFrameTimeRef = useRef<number>(0);
  const rotationStartTimeRef = useRef<number | null>(null);
  const accumulatedRotationTimeRef = useRef<number>(0);
  const initialTimeOffsetRef = useRef<number>(0); // 初始时间偏移（毫秒）

  // 标记点引用（保持不变）
  const markersRef = useRef<THREE.Mesh[]>([]);

  // GUI配置参数（初始时间设置为8:04）
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

    latitudePosition: 31,   // 上海纬度
    longitudePosition: 121,  // 上海经度
    shanghaiTimeStr: '08:04' // 初始上海时间
  });

  const revolutionGuiRef = useRef<any>(null);

  const initScene = () => {
    if (!canvasRef.current) return;

    // 初始化渲染器（保持不变）
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 初始化场景（保持不变）
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050515);
    const starts = makeStars();
    scene.add(starts);

    // 初始化相机（保持不变）
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

    // 创建各类相机（保持不变）
    const mainCamera = createCamera([75, window.innerWidth / window.innerHeight, 0.1, 1000], [0, 15, 40], '主相机');
    const observeInnerEarthCamera = createCamera([75, window.innerWidth / window.innerHeight, 0.001, 1000], [0, 0, 0], '观察内圈地球相机');
    const observeOutEarthCamera = createCamera([75, window.innerWidth / window.innerHeight, 0.1, 1000], [0, 0, 0], '观察外圈地球相机');
    const observeEarthNorthPoleCamera = createCamera([80, window.innerWidth / window.innerHeight, 0.1, 300], [0, 0, 0], '观察地球北极相机', false);
    const observeEarthSouthPoleCamera = createCamera([80, window.innerWidth / window.innerHeight, 0.1, 300], [0, 0, 0], '观察地球南极相机', false);
    const observeEarthNightLineCamera = createCamera([80, window.innerWidth / window.innerHeight, 0.1, 300], [0, 0, 0], '观察地球昏线相机', false);
    const observeEarthMorningLineCamera = createCamera([80, window.innerWidth / window.innerHeight, 0.1, 300], [0, 0, 0], '观察地球晨线相机', false);

    // 初始化控制器（保持不变）
    const { controls } = makeAmbientLight_AxesHelper_OrbitControls(scene, mainCamera, renderer);

    // 创建标记点（保持不变）
    const createMarker = (lat: number, lon: number, color: string = '#00b96b', size: number = 0.05): THREE.Mesh => {
      if (!earthRef.current) return new THREE.Mesh();
      destroyOldMarkers();
      const earthMesh = earthRef.current;
      const earthScale = earthMesh.scale.x;
      const actualEarthRadius = earthRadiusRef.current / earthScale;
      const position = latLonToPosition(lat, lon, actualEarthRadius);
      const geometry = new THREE.SphereGeometry(size, 16, 16);
      const material = new THREE.MeshBasicMaterial({ color });
      const marker = new THREE.Mesh(geometry, material);
      marker.position.copy(position);
      markersRef.current.push(marker);
      earthMesh.add(marker);
      return marker;
    };

    // 销毁旧标记点（保持不变）
    const destroyOldMarkers = () => {
      if (markersRef.current.length === 0) return;
      markersRef.current.forEach(marker => {
        if (marker.parent) marker.parent.remove(marker);
        marker.geometry.dispose();
        if (Array.isArray(marker.material)) {
          marker.material.forEach(mat => mat.dispose());
        } else {
          marker.material.dispose();
        }
      });
      markersRef.current = [];
    };

    // 更新太阳光目标（保持不变）
    const updateSunlightTarget = () => {
      if (sunLightRef.current && earthGroupRef.current) {
        sunLightRef.current.target.position.copy(earthGroupRef.current.position);
        sunLightRef.current.target.updateMatrixWorld();
      }
    };

    // 设置运动相机位置（保持不变）
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

    // 创建太阳（保持不变）
    const createSun = () => {
      const { sun, sunLight } = makeSun(scene);
      sunLightRef.current = sunLight;
      sunPositionRef.current.copy(sun.position);
      sunRef.current = sun;
      currentDirectLatRef.current = solarTerms[activeSolarTermsIndexInit].directLat;
      targetDirectLatRef.current = currentDirectLatRef.current;
      return sun;
    };

    // 创建轨道（保持不变）
    const createOrbit = () => {
      const orbit = makeOrbit(scene);
      orbitRef.current = orbit;
      return orbit;
    };

    // 创建地球（核心修改：调整初始旋转角度匹配8:04）
    const createEarth = () => {
      // 创建地球组
      const earthGroup = new THREE.Group();
      earthGroup.name = 'EarthGroup';
      earthGroupRef.current = earthGroup;

      // 创建地球几何体和材质
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

      // 应用黄赤交角
      earthMesh.rotation.x = obliquityRad;

      // 添加地球到地球组
      earthGroup.add(earthMesh);

      // 创建经纬线
      const latLonLines = createDebugLatLonSphere(earthRadiusRef.current, earthGroup);
      lineGroupRef.current = latLonLines;
      earthMesh.add(latLonLines);

      // 创建初始标记点（上海）
      createMarker(guiConfigParamsRef.current.latitudePosition, guiConfigParamsRef.current.longitudePosition);

      // 核心修改：计算8:04对应的初始时间偏移量
      // 8:04与晨线6:00相差2小时4分钟 = 124分钟
      // 计算对应的毫秒数（基于自转周期）
      const minutesOffset = 2 * 60 + 4; // 8:04 - 6:00 = 124分钟
      const rotationCycleMinutes = 24 * 60; // 自转周期（分钟）
      // 计算需要的初始时间偏移（让时间系统从8:04开始）
      initialTimeOffsetRef.current =
        (minutesOffset / rotationCycleMinutes) * autoRevolutionTimeInit * 1000;

      // 初始化累计旋转时间（直接设置为初始偏移量）
      accumulatedRotationTimeRef.current = initialTimeOffsetRef.current;



      // 配置特殊视角相机（保持不变）
      observeEarthNorthPoleCamera.position.set(0.1, 6, -0.1);
      observeEarthNorthPoleCamera.lookAt(earthGroup.position);
      earthGroup.add(observeEarthNorthPoleCamera);

      observeEarthSouthPoleCamera.position.set(0.1, -6, 0.1);
      observeEarthSouthPoleCamera.lookAt(earthGroup.position);
      earthGroup.add(observeEarthSouthPoleCamera);

      // 初始地球位置（春分）
      const initSolarTerm = solarTerms[guiConfigParamsRef.current.activeSolarTermsIndex];
      earthGroup.position.set(...getEarthCenterPos(initSolarTerm.angle));

      // 添加地球组到场景（保持不变）
      scene.add(earthGroup);
      const solarTermsInstance = makeSolarTermsEarth();
      scene.add(...solarTermsInstance);

      // 设置初始相机位置（保持不变）
      setSportCameraPosition([
        { position: { y: earthGroupRef.current!.position.y + 2 }, targetAngle: initSolarTerm.angle, radius: staticConfig.radius / 2, camera: observeInnerEarthCamera },
        { position: { y: earthGroupRef.current!.position.y + 2 }, targetAngle: initSolarTerm.angle, radius: staticConfig.radius + 5, camera: observeOutEarthCamera },
        { position: { y: earthGroupRef.current!.position.y + 2 }, targetAngle: initSolarTerm.angle + staticConfig.observeOrbitEarthBaseAngle, radius: staticConfig.radius, camera: observeEarthNightLineCamera },
        { position: { y: earthGroupRef.current!.position.y + 2 }, targetAngle: initSolarTerm.angle - staticConfig.observeOrbitEarthBaseAngle, radius: staticConfig.radius, camera: observeEarthMorningLineCamera }
      ]);

      // 初始化时间
      guiConfigParamsRef.current.revolutionStartTime = performance.now();
      lastFrameTimeRef.current = performance.now();
    };

    // 创建GUI控制器（保持不变）
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
          const now = performance.now();
          if (val) {
            rotationStartTimeRef.current = now;
          } else {
            if (rotationStartTimeRef.current) {
              accumulatedRotationTimeRef.current += now - rotationStartTimeRef.current;
              rotationStartTimeRef.current = null;
            }
          }
        });

      autoroatationFolder.add(params, 'autonRevolutionTimeMutiple')
        .min(1).max(10).step(1)
        .name('自转速度倍数');

      // 节气控制（保持不变）
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
          const targetDirectLat = selectedSolarTerm.directLat;

          if (earthGroupRef.current) {
            const targetEarthCenter = getEarthCenterPos(targetAngle);
            earthGroupRef.current.position.set(...targetEarthCenter);
            updateSunlightTarget();
            setSportCameraPosition([
              { position: { y: earthGroupRef.current!.position.y + 2 }, targetAngle, radius: staticConfig.radius / 2, camera: observeInnerEarthCamera },
              { position: { y: earthGroupRef.current!.position.y + 2 }, targetAngle, radius: staticConfig.radius + 5, camera: observeOutEarthCamera },
              { position: { y: earthGroupRef.current!.position.y + 2 }, targetAngle: targetAngle + staticConfig.observeOrbitEarthBaseAngle, radius: staticConfig.radius, camera: observeEarthNightLineCamera },
              { position: { y: earthGroupRef.current!.position.y + 2 }, targetAngle: targetAngle - staticConfig.observeOrbitEarthBaseAngle, radius: staticConfig.radius, camera: observeEarthMorningLineCamera }
            ]);
          }

          isDirectLatTransitionRef.current = true;
          targetDirectLatRef.current = targetDirectLat;
          transitionStartTimeRef.current = now;
          params.baseAngle = targetAngle;
          params.revolutionStartTime = now;
        });

      // 其他GUI控制项（保持不变）
      const sunLightFolder = guiRef.current.addFolder('光照&直射光线控制');
      sunLightFolder.add(params, 'sunlightIntensity')
        .min(0.1).max(3).step(0.1)
        .name('太阳光强度')
        .onFinishChange((val: number) => {
          if (sunLightRef.current) sunLightRef.current.intensity = val;
        });

      sunLightFolder.add(params, 'showSunDirectLine')
        .name('显示太阳直射光线')
        .onChange((val: boolean) => {
          if (sunDirectCylinderRef.current) sunDirectCylinderRef.current.visible = val;
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
      latitudeAndLongitudeFolder.add(params, 'latitudePosition')
        .min(-90).max(90).step(0.1)
        .name('纬度')
        .onFinishChange((val: number) => {
          createMarker(val, params.longitudePosition);
        });

      latitudeAndLongitudeFolder.add(params, 'longitudePosition')
        .min(-180).max(180).step(0.1)
        .name('经度')
        .onFinishChange((val: number) => {
          createMarker(params.latitudePosition, val);
        });
    };

    // 初始化场景（保持不变）
    const make = () => {
      createSun();
      createOrbit();
      createEarth();
      createGUI();
      rotationStartTimeRef.current = null; // 初始不开启自转
    };
    make();

    // 窗口大小调整（保持不变）
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

    // 时间格式化（保持不变）
    const formatTime = (totalMinutes: number): string => {
      const hours = Math.floor(totalMinutes / 60) % 24;
      const minutes = Math.floor(totalMinutes % 60);
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    };

    // 动画循环（保持不变）
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
      // 自转逻辑（核心修改）
      const earthMesh = earthRef.current;
      const deltaTime = time - lastFrameTimeRef.current;
      const deltaTimeSec = deltaTime / 1000;
      lastFrameTimeRef.current = time;

      if (earthMesh && params.isAutoRoatation) {
        // 计算自转角度（保持不变）
        const rotateAngle = baseAngularVelocity * params.autonRevolutionTimeMutiple * deltaTimeSec;
        earthMesh.rotation.y += rotateAngle;

        // 时间计算（核心修改：从8:04开始累加）
        let totalRotationTime = accumulatedRotationTimeRef.current;

        if (rotationStartTimeRef.current) {
          // 累加自转时间（从初始偏移量开始）
          totalRotationTime += time - rotationStartTimeRef.current;
        } else {
          // 首次开启自转时设置起始点
          rotationStartTimeRef.current = time;
        }

        // 计算总分钟数（包含初始偏移）
        const rotationRatio = totalRotationTime / (autoRevolutionTimeInit * 1000);

        const totalMinutes = (rotationRatio * 24 * 60) % (24 * 60);

        const shanghaiOffsetMinutes = 6 * 60; // 晨线基准时间（6:00）

        // 直接显示计算结果（已包含初始偏移）
        params.shanghaiTimeStr = formatTime(shanghaiOffsetMinutes + totalMinutes);
      }

      // 渲染场景
      controls.update();
      renderer.render(scene, cameraInstanceList[params.activeCameraIndex]);
      requestAnimationFrame(animate);
    };

    // 启动动画（保持不变）
    requestAnimationFrame(animate);
    window.addEventListener('resize', handleResize);

    // 清理函数（保持不变）
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
