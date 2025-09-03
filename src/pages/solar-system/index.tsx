import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BooleanController, GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

const SolarSystem: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const earthGroupRef = useRef<THREE.Group | null>(null);
  const earthRef = useRef<THREE.Group<THREE.Object3DEventMap>>(null);
  const orbitRef = useRef<THREE.Mesh | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const lineGroupRef = useRef<THREE.Group | null>(null);
  const guiRef = useRef<GUI>(null);
  const sunLightLineRef = useRef<THREE.LineSegments | null>(null);
  const sunPositionRef = useRef<THREE.Vector3>(new THREE.Vector3(2, 0, 0));
  const sunRef = useRef<THREE.Mesh | null>(null);
  const sunRadius = 3;
  const earthRadiusRef = useRef<number>(0.3);

  // 原有回归线相关引用
  const northTropicLineRef = useRef<THREE.LineSegments | null>(null);
  const southTropicLineRef = useRef<THREE.LineSegments | null>(null);
  const northTropicMarkerRef = useRef<THREE.Mesh | null>(null);
  const southTropicMarkerRef = useRef<THREE.Mesh | null>(null);

  // 新增：太阳直射光线相关引用
  const sunDirectLineRef = useRef<THREE.LineSegments | null>(null); // 直射光线线条
  const directPointRef = useRef<THREE.Vector3>(new THREE.Vector3()); // 直射点坐标（地球表面）
  const currentDirectLatRef = useRef<number>(0); // 当前直射纬度（实时更新，用于过渡）
  const targetDirectLatRef = useRef<number>(0); // 目标直射纬度（节气切换时使用）
  const isDirectLatTransitionRef = useRef<boolean>(false); // 是否处于直射纬度过渡中
  const transitionStartTimeRef = useRef<number>(0); // 过渡开始时间
  const transitionDuration = 1000; // 过渡时长（ms），1秒平滑过渡

  // 黄赤交角（核心参数）
  const obliquity = 23.5; // 度
  const obliquityRad = THREE.MathUtils.degToRad(obliquity); // 弧度制黄赤交角

  // 节气配置（包含直射纬度）
  const solarTerms = [
    { name: '春分', angle: 0, directLat: 0 },               // 春分：右侧（0°）
    { name: '夏至', angle: -Math.PI / 2, directLat: obliquity }, // 夏至：上方（-90°，即270°）
    { name: '秋分', angle: -Math.PI, directLat: 0 },        // 秋分：左侧（-180°）
    { name: '冬至', angle: -Math.PI * 3 / 2, directLat: -obliquity } // 冬至：下方（-270°，即90°）
  ];

  /** 公转周期：36.5s 一圈 */
  const revolutionTimeInit = 36.5;
  const activeSolarTermsIndexInit = 0;
  const activeCameraIndexInit = 0;

  // 静态配置
  const staticConfig = {
    radius: 25,                      // 轨道半径
    revolutionTime: revolutionTimeInit, // 公转周期（秒/圈）
    earthRotationSpeed: 0.02,        // 地球自转速度
    sunlightIntensity: 2.5,          // 太阳光强度
    observeOrbitEarthBaseAngle: Math.PI / 8,
    directLineWidth: 3, // 直射光线宽度（比其他线粗，突出显示）
    directLineColor: 0xffa500 // 直射光线颜色（橙色，区分其他线条）
  };

  // GUI 配置参数（新增：直射光线控制）
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

    isAutoroatation: true,
    autonRevolutionTimeMutiple: 1,

    showSunDirectLine: true, // 新增：直射光线显示开关
    directLineIntensity: 1.0 // 新增：直射光线透明度（0~1）
  });

  const revolutionGuiRef = useRef<BooleanController<{ isRevolution: boolean }>>(null);

  /** 根据角度计算地球中心位置 */
  const getEarthCenterPos = (angle: number, radius?: number): [number, number, number] => {
    const useRadis = radius || staticConfig.radius;
    return [
      Math.cos(angle) * useRadis,
      0, // 轨道平面为赤道面（Y=0）
      Math.sin(angle) * useRadis
    ];
  };


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

    const mainCamera = createCamera([75, window.innerWidth / window.innerHeight, 0.1, 1000], [0, 30, 40], '主相机');
    const observeInnerEarthCamera = createCamera([75, window.innerWidth / window.innerHeight, 0.001, 1000], [0, 0, 0], '观察内圈地球相机');
    const observeOutEarthCamera = createCamera([75, window.innerWidth / window.innerHeight, 0.1, 1000], [0, 0, 0], '观察外圈地球相机');
    const observeEarthNorthPoleCamera = createCamera([80, window.innerWidth / window.innerHeight, 0.1, 300], [0, 0, 0], '观察地球北极相机', false);
    const observeEarthSouthPoleCamera = createCamera([80, window.innerWidth / window.innerHeight, 0.1, 300], [0, 0, 0], '观察地球南极相机', false);
    const observeOrbitEarthCamera = createCamera([80, window.innerWidth / window.innerHeight, 0.1, 300], [0, 0, 0], '观察轨道地球相机', false);


    /** 新增：创建太阳直射光线（从太阳中心到地球直射点） */
    const createSunDirectLine = (): THREE.LineSegments => {
      // 线条几何体：2个点（太阳中心 + 地球直射点）
      const geometry = new THREE.BufferGeometry();

      const positions = new Float32Array(6); // [x1,y1,z1, x2,y2,z2]

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      // 线条材质：橙色、粗线宽、半透明，突出直射效果
      const material = new THREE.LineBasicMaterial({
        color: staticConfig.directLineColor,
        linewidth: staticConfig.directLineWidth * 200,
        depthWrite: false, // 避免被地球遮挡
        transparent: true,
        opacity: guiConfigParamsRef.current.directLineIntensity
      });

      const line = new THREE.LineSegments(geometry, material);
      scene.add(line); // 独立添加到场景，不跟随地球自转
      return line;
    };

    /** 新增：计算当前直射点的地球表面坐标（局部坐标） */
    const calculateDirectPointLocal = (directLat: number): THREE.Vector3 => {
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

    /** 新增：更新太阳直射光线位置（含过渡效果） */
    const updateSunDirectLine = (time: number) => {
      const params = guiConfigParamsRef.current;
      if (!sunRef.current || !earthGroupRef.current || !sunDirectLineRef.current) return;

      if (isDirectLatTransitionRef.current) {
        // 手动切换节气时的过渡逻辑（保持不变）
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
        // 【核心修正：调整角度映射，使直射点先北移后南移】
        const currentAngle = params.baseAngle + (time - params.revolutionStartTime) * 0.001 / staticConfig.revolutionTime * Math.PI * 2;
        // 关键：用-cos函数替代sin，确保角度0→π/2→π→3π/2时，直射纬度0→23.5°→0→-23.5°
        const latRatio = -Math.cos(currentAngle); // 角度0→cos(0)=1→-1→直射纬度0；角度π/2→cos(π/2)=0→0→23.5°
        currentDirectLatRef.current = latRatio * obliquity;
      }

      // 后续计算直射点坐标和线条位置的逻辑保持不变...
      const directPointLocal = calculateDirectPointLocal(currentDirectLatRef.current);
      const directPointWorld = directPointLocal.applyMatrix4(earthGroupRef.current.matrixWorld);
      directPointRef.current.copy(directPointWorld);

      const sunWorldPos = new THREE.Vector3();
      sunRef.current.getWorldPosition(sunWorldPos);

      const lineGeo = sunDirectLineRef.current.geometry as THREE.BufferGeometry;
      const linePos = lineGeo.getAttribute('position').array as Float32Array;
      linePos.set([...sunWorldPos.toArray(), ...directPointWorld.toArray()]);
      lineGeo.attributes.position.needsUpdate = true;

      const lineMat = sunDirectLineRef.current.material as THREE.LineBasicMaterial;
      lineMat.opacity = params.directLineIntensity;
      sunDirectLineRef.current.visible = params.showSunDirectLine;
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

    /** 灯光 */
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
    scene.add(ambientLight);

    /** 轨道控制器 */
    const controls = new OrbitControls(mainCamera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0, 0);

    /** 坐标系辅助线 */
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);

    /** 创建太阳（初始化直射光线） */
    const createSun = () => {
      const textureLoader = new THREE.TextureLoader();
      const suntexture = textureLoader.load(window.$$prefix + '/textures/sun.png');

      const sunGeometry = new THREE.SphereGeometry(sunRadius, 32, 32);
      const sunMaterial = new THREE.MeshBasicMaterial({ map: suntexture });
      const sun = new THREE.Mesh(sunGeometry, sunMaterial);
      sun.position.set(0, 0, 5);
      sunPositionRef.current.copy(sun.position);
      sunRef.current = sun;

      const sunLight = new THREE.DirectionalLight(0xffffff, staticConfig.sunlightIntensity);
      sunLight.castShadow = true;
      sunLightRef.current = sunLight;

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

      // 初始化太阳直射光线（在太阳创建后）
      sunDirectLineRef.current = createSunDirectLine();
      // 初始直射纬度（春分：0°）
      currentDirectLatRef.current = solarTerms[activeSolarTermsIndexInit].directLat;
      targetDirectLatRef.current = currentDirectLatRef.current;

      return sun;
    };

    /** 创建轨道 */
    const createOrbit = () => {
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
      orbitRef.current = orbit;
      return orbit;
    };

    /** 创建节气辅助球体 */
    const createSolarTermsEarth = () => {
      const seasonGeometry = new THREE.SphereGeometry(1, 32, 32);
      const seasonMaterial = new THREE.MeshBasicMaterial({
        color: '#24758f',
        transparent: true,
        opacity: 0.2
      });

      return solarTerms.map(item => {
        const seasonMesh = new THREE.Mesh(seasonGeometry, seasonMaterial);
        seasonMesh.position.set(...getEarthCenterPos(item.angle));
        seasonMesh.userData = item;
        scene.add(seasonMesh);
        return seasonMesh;
      });
    };

    const solarTermsEarthInstanceList = createSolarTermsEarth();

    /** 创建回归线连线 */
    const createTropicLine = (color: number): THREE.LineSegments => {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(6);
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const material = new THREE.LineBasicMaterial({
        color,
        linewidth: 2,
        depthWrite: false,
        transparent: true,
        opacity: 0.8
      });

      const line = new THREE.LineSegments(geometry, material);
      scene.add(line);
      return line;
    };

    /** 加载地球模型 */
    const loadEarth = () => {
      const loader = new GLTFLoader();
      loader.load(
        window.$$prefix + '/models/earth/scene.gltf',
        (gltf) => {
          const earthMesh = gltf.scene;

          const textureLoader = new THREE.TextureLoader();
          const earthTexture = textureLoader.load(
            window.$$prefix + '/models/earth/textures/Material.002_diffuse.jpeg'
          );

          earthMesh.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.material = new THREE.MeshStandardMaterial({
                map: earthTexture,
                roughness: 0.8,
                metalness: 0.2,
                side: THREE.FrontSide
              });
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          earthRef.current = earthMesh;

          const earthGroup = new THREE.Group();
          earthGroup.name = 'EarthGroup';
          earthGroupRef.current = earthGroup;

          const earthScale = 0.018;
          earthMesh.scale.set(earthScale, earthScale, earthScale);
          earthRadiusRef.current = 1.5 * earthScale * 1.2 * 15; // 地球模型实际半径

          // 地球自转轴倾斜（黄赤交角）
          earthMesh.rotation.x = obliquityRad;

          earthGroup.add(earthMesh);

          /** 创建经纬线&极点&回归线标记 */
          const createDebugLatLonSphere = () => {
            const linesGroup = new THREE.Group();
            linesGroup.name = 'linesGroup';
            lineGroupRef.current = linesGroup;

            const baseSize = 1.5;
            const distanceFromEarth = 0.002;
            const actualRadius = baseSize + distanceFromEarth;

            // 纬线
            const latitudes = [
              { lat: 0, color: '#ff1030', width: 0.03 },     // 赤道
              { lat: obliquity, color: '#f5f500', width: 0.03 }, // 北回归线
              { lat: 30, color: '#fff', width: 0.006 },
              { lat: 60, color: '#fff', width: 0.006 },
              { lat: -obliquity, color: '#f5f500', width: 0.03 },// 南回归线
              { lat: -30, color: '#fff', width: 0.006 },
              { lat: -60, color: '#fff', width: 0.006 },
            ];

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
                  depthWrite: false
                })
              );
              latLine.position.y = latYPos;
              latLine.rotation.x = Math.PI / 2;
              latLine.name = `latitude-item-${latItem.lat}`;
              linesGroup.add(latLine);
            });

            // 经线
            const longitudes = [
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
              { lon: 360, color: '#00b96b' },
            ];

            longitudes.forEach((lonItem, index) => {
              const lonRad = THREE.MathUtils.degToRad(lonItem.lon);
              const meridian = new THREE.Mesh(
                new THREE.RingGeometry(0, actualRadius + 0.001, 128, 0, Math.PI),
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
              meridian.position.z = 0.0001 * index;
              meridian.name = `longitude-item-${lonItem.lon}`;
              linesGroup.add(meridian);
            });

            // 极点标记
            const northPoleMarker = new THREE.Mesh(
              new THREE.SphereGeometry(0.02, 16, 16),
              new THREE.MeshBasicMaterial({ color: 0xffffff })
            );
            northPoleMarker.position.y = actualRadius;
            northPoleMarker.name = 'north-pole-marker';
            linesGroup.add(northPoleMarker);

            const southPoleMarker = new THREE.Mesh(
              new THREE.SphereGeometry(0.02, 16, 16),
              new THREE.MeshBasicMaterial({ color: 0xffffff })
            );
            southPoleMarker.position.y = -actualRadius;
            southPoleMarker.name = 'south-pole-marker';
            linesGroup.add(southPoleMarker);

            // 应用自转轴倾斜
            linesGroup.rotation.x = obliquityRad;
            linesGroup.scale.set(1.2, 1.2, 1.2);

            return linesGroup;
          };

          const latLonLines = createDebugLatLonSphere();
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

          // 初始化回归线连线
          northTropicLineRef.current = createTropicLine(0xff4444);
          southTropicLineRef.current = createTropicLine(0x4444ff);

          guiConfigParamsRef.current.revolutionStartTime = performance.now();
        },
        (xhr) => console.log(`地球加载中: ${(xhr.loaded / xhr.total * 100).toFixed(1)}%`),
        (error) => console.error('地球加载错误:', error)
      );
    };

    /** 创建GUI（新增直射光线控制） */
    const createGUI = () => {
      if (guiRef.current) guiRef.current.destroy();
      guiRef.current = new GUI();
      guiRef.current.title('参数控制');
      const params = guiConfigParamsRef.current;

      // 公转控制
      const revolutionFolder = guiRef.current.addFolder('公转控制');
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

      // @ts-ignore
      revolutionGuiRef.current = revolutionFolder.add(params, 'isRevolution')
        .name('是否开启公转')
        .onChange((val: boolean) => handleRevolution(val));

      revolutionFolder.add(params, 'revolutionTimeMutiple')
        .min(1).max(10).step(1)
        .name('公转速度倍数')
        .onFinishChange((val: number) => {
          staticConfig.revolutionTime = revolutionTimeInit / val;
        });

      // 自转控制
      const autoroatationFolder = guiRef.current.addFolder('自转控制');

      // @ts-ignore
      autoroatationFolder.add(params, 'isAutoroatation')
        .name('是否开启自转')

      autoroatationFolder.add(params, 'autonRevolutionTimeMutiple')
        .min(1).max(10).step(1)
        .name('自转速度倍数')
        .onFinishChange((val: number) => {
        });


      // 节气控制（修改：触发直射纬度过渡）
      const solarTermsFolder = guiRef.current.addFolder('节气控制');
      const solarTermsOptions: Record<string, number> = {};
      solarTerms.forEach((item, index) => {
        solarTermsOptions[item.name] = index;
      });

      solarTermsFolder.add(params, 'activeSolarTermsIndex')
        .options(solarTermsOptions)
        .name('切换节气')
        .onChange((selectedIndex: any) => {
          const now = performance.now();
          const params = guiConfigParamsRef.current;
          params.isRevolution = false;
          handleRevolution(params.isRevolution);
          revolutionGuiRef.current!.updateDisplay();

          const selectedSolarTerm = solarTerms[selectedIndex];
          const targetAngle = selectedSolarTerm.angle;
          const targetDirectLat = selectedSolarTerm.directLat;

          // 更新地球位置
          if (earthGroupRef.current) {
            const targetEarthCenter = getEarthCenterPos(targetAngle);
            earthGroupRef.current.position.set(...targetEarthCenter);

            setSportCameraPosition([
              { position: { y: earthGroupRef.current!.position.y + 2, x: 12 }, targetAngle, radius: staticConfig.radius / 2, camera: observeInnerEarthCamera },
              { position: { y: earthGroupRef.current!.position.y + 2 }, targetAngle, radius: staticConfig.radius + 2, camera: observeOutEarthCamera },
              { position: { y: earthGroupRef.current!.position.y + 2 }, targetAngle: targetAngle + staticConfig.observeOrbitEarthBaseAngle, radius: staticConfig.radius, camera: observeOrbitEarthCamera }
            ]);
          }

          // 触发直射纬度过渡
          isDirectLatTransitionRef.current = false;

          targetDirectLatRef.current = targetDirectLat; // 目标纬度

          transitionStartTimeRef.current = now; // 过渡开始时间

          // ⑤ 立即更新直射光线位置，确保光线精准对准
          if (sunDirectLineRef.current) {
            updateSunDirectLine(now); // 手动触发一次光线更新
          }

          params.baseAngle = targetAngle;
          params.revolutionStartTime = now;
        });

      // 光照&直射光线控制（新增直射光线参数）
      const sunLightFolder = guiRef.current.addFolder('光照&直射光线控制');
      sunLightFolder.add(params, 'sunlightIntensity')
        .min(0.1).max(3).step(0.1)
        .name('太阳光强度')
        .onFinishChange((val: number) => {
          if (sunLightRef.current) sunLightRef.current.intensity = val;
        });



      // 新增：直射光线控制
      sunLightFolder.add(params, 'showSunDirectLine')
        .name('显示太阳直射光线')
        .onChange((val: boolean) => {
          if (sunDirectLineRef.current) sunDirectLineRef.current.visible = val;
        });

      sunLightFolder.add(params, 'directLineIntensity')
        .min(0.1).max(1.0).step(0.1)
        .name('直射光线透明度')
        .onFinishChange((val: number) => {
          if (sunDirectLineRef.current) {
            const lineMat = sunDirectLineRef.current.material as THREE.LineBasicMaterial;
            lineMat.opacity = val;
          }
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
    };

    /** 创建星空 */
    const createStars = () => {
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
        size: 0.2,
        sizeAttenuation: true,
        color: '#ff88cc',
        transparent: true,
        alphaMap: texture,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true
      });

      const stars = new THREE.Points(geometry, material);
      scene.add(stars);
    };

    /** 初始化场景 */
    const make = () => {
      createSun(); // 创建太阳时初始化直射光线
      createSunDirectLine();
      createOrbit();
      loadEarth();
      createStars();
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

    /** 动画循环（新增直射光线更新） */
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
            { position: { y: earthGroupRef.current!.position.y + 2 }, targetAngle: currentAngle, radius: staticConfig.radius / 1.5, camera: observeInnerEarthCamera },
            { position: { y: earthGroupRef.current!.position.y + 2 }, targetAngle: currentAngle, radius: staticConfig.radius + 5, camera: observeOutEarthCamera },
            { position: { y: earthGroupRef.current!.position.y + 2 }, targetAngle: currentAngle + staticConfig.observeOrbitEarthBaseAngle, radius: staticConfig.radius, camera: observeOrbitEarthCamera }
          ]);
        }

        // 2. 更新光照目标
        const normalizedAngle = (currentAngle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        const adjustedAngle = normalizedAngle + Math.PI / 2;
        const sinValue = Math.sin(adjustedAngle);
        const maxOffset = 6;
        const lightOffsetY = sinValue * maxOffset;

        sunLightRef.current.target.position.set(
          earthGroupRef.current.position.x,
          earthGroupRef.current.position.y + lightOffsetY,
          earthGroupRef.current.position.z
        );
        sunLightRef.current.target.updateMatrixWorld();

        // 3. 地球自转
        const earthMesh = earthRef.current;
        if (earthMesh) {
          earthMesh.rotation.y -= params.isAutoroatation ? staticConfig.earthRotationSpeed * params.autonRevolutionTimeMutiple : 0;
        }

        // 5. 新增：更新太阳直射光线（含过渡效果）
        updateSunDirectLine(time);
      }

      controls.update();
      renderer.render(scene, cameraInstanceList[params.activeCameraIndex]);
      requestAnimationFrame(animate);
    };

    /** 启动动画 */
    requestAnimationFrame(animate);
    window.addEventListener('resize', handleResize);

    /** 清理（新增直射光线资源释放） */
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer?.dispose();
      guiRef.current?.destroy();

      // 释放线条资源
      [northTropicLineRef, southTropicLineRef, sunDirectLineRef].forEach(ref => {
        if (ref.current) {
          ref.current.geometry.dispose();
          (ref.current.material as THREE.Material).dispose();
        }
      });
    };
  };

  useEffect(() => {
    const cleanup = initScene();
    return cleanup;
  }, []);

  return (
    <div className='canvas-container' style={{ width: '100vw', height: '100vh' }}>
      <canvas
        className='canvas-body'
        ref={canvasRef}
        style={{ width: '100%', height: '100%' }}
      ></canvas>
    </div>
  );
};

export default SolarSystem;