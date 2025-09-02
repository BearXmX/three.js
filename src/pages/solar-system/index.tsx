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

  // 节气配置：name + 对应的轨道角度（弧度）
  const solarTerms = [
    { name: '春分', angle: -(Math.PI / 2) },    // 初始角度
    { name: '夏至', angle: -Math.PI },          // 向左90°
    { name: '秋分', angle: -(Math.PI * 3 / 2) },// 向下90°
    { name: '冬至', angle: 0 }                  // 向右90°
  ];

  /** 公转初始时间：36.5s 一圈 */
  const revolutionTimeInit = 36.5;

  // 节气索引初始值为 0（对应春分）
  const activeSolarTermsIndexInit = 0;

  // 相机索引初始值为 0（对应主相机）
  const activeCameraIndexInit = 0;

  // GUI 配置参数（核心：增加当前基准角度）
  const guiConfigParamsRef = useRef({
    revolutionTimeMutiple: 1,        // 公转速度倍数
    sunlightIntensity: 1.5,          // 太阳光强度
    isRevolution: true,              // 默认开始公转
    activeSolarTermsIndex: activeSolarTermsIndexInit, // 当前选中的节气索引

    lastPauseStartTime: 0,           // 最近一次暂停开始时间
    baseAngle: solarTerms[activeSolarTermsIndexInit].angle, // 当前基准角度（关键）
    revolutionStartTime: 0, // 公转基准时间
    accumulatedSeconds: 0, // 累计公转时间（秒）

    activeCameraIndex: activeCameraIndexInit,

    showLongtitudeLine: true,
    showLatitudeLine: true,
    showNorthPoleMarker: true,
    showNSouthPoleMarker: true,
  });

  const revolutionGuiRef = useRef<BooleanController<{
    isRevolution: boolean
  }>>(null);

  // 静态配置
  const staticConfig = {
    radius: 15,                      // 轨道半径
    revolutionTime: revolutionTimeInit, // 公转周期（秒/圈）
    inclination: 23.5,               // 黄赤夹角（度）
    earthRotationSpeed: 0.02,        // 地球自转速度
    sunlightIntensity: 1.5           // 初始太阳光强度
  };

  /** 根据角度计算三维位置 */
  const getEarthPostiton = (angle: number, radius?: number): [number, number, number] => {
    const inclineRad = THREE.MathUtils.degToRad(staticConfig.inclination);

    const useRadis = radius || staticConfig.radius;

    return [
      Math.cos(angle) * useRadis,
      Math.sin(angle) * useRadis * Math.sin(inclineRad),
      Math.sin(angle) * useRadis * Math.cos(inclineRad)
    ];
  };


  const initScene = () => {
    if (!canvasRef.current) return;

    /* 1. 创建渲染器 */
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    /* 2. 创建场景和相机 */
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050515);

    const cameraInstanceList = [] as THREE.PerspectiveCamera[]

    const createCamera = (base: [fov: number, aspect: number, near: number, far: number], position: [x: number, y: number, z: number], name: string, addToScene = true) => {
      const camera = new THREE.PerspectiveCamera(...base);

      camera.position.set(...position);

      camera.lookAt(0, 0, 0);

      camera.userData.name = name;

      cameraInstanceList.push(camera);

      if (addToScene) {
        scene.add(camera);
      }

      return camera;
    };

    const mainCamera = createCamera([75, window.innerWidth / window.innerHeight, 0.1, 1000], [5, 20, 20], '主相机')

    const observeInnerEarthCamera = createCamera([45, window.innerWidth / window.innerHeight, 0.1, 1000], [0, 0, 0], '观察内圈地球相机')

    const observeOutEarthCamera = createCamera([45, window.innerWidth / window.innerHeight, 0.1, 1000], [0, 0, 0], '观察外圈地球相机')

    // --- 北极相机（添加到组中）---
    const observeEarthNorthPoleCamera = createCamera(
      [80, window.innerWidth / window.innerHeight, 0.1, 300],
      [0, 0, 0],
      '观察地球北极相机',
      false
    );

    // --- 南极相机（添加到组中）---
    const observeEarthSouthPoleCamera = createCamera(
      [80, window.innerWidth / window.innerHeight, 0.1, 300],
      [0, 0, 0],
      '观察地球南极相机',
      false
    );

    /*     const observeEarthNorthPoleCameraHelper = new THREE.CameraHelper(observeEarthNorthPoleCamera);
    
        scene.add(observeEarthNorthPoleCameraHelper); */

    /** @description 更新观察外圈相机位置 */

    const setObserveInnerEarthCameraPosition = (targetAngle: number) => {
      const observeInnerEarthCameraPosition = getEarthPostiton(targetAngle, 2);

      observeInnerEarthCameraPosition[1] = earthGroupRef.current!.position.y + 2;

      observeInnerEarthCamera.position.set(...observeInnerEarthCameraPosition);

      observeInnerEarthCamera.lookAt(earthGroupRef.current!.position);
    }

    /** @description 更新观察外圈相机位置 */
    const setObserveOutEarthCameraPosition = (targetAngle: number) => {
      const observeOutEarthCameraPosition = getEarthPostiton(targetAngle, staticConfig.radius * 2);

      observeOutEarthCameraPosition[1] = earthGroupRef.current!.position.y + 2;

      observeOutEarthCamera.position.set(...observeOutEarthCameraPosition);

      observeOutEarthCamera.lookAt(earthGroupRef.current!.position);
    }

    /** @description 灯光控制器 */
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
    scene.add(ambientLight);

    /** @description 轨道控制器 */
    const controls = new OrbitControls(mainCamera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0, 0);

    /** @description 世界坐标系辅助线 */
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);

    /** @description 创建太阳 */
    const createSun = () => {
      const textureLoader = new THREE.TextureLoader();
      const suntexture = textureLoader.load(window.$$prefix + '/textures/sun.png');

      const sunGeometry = new THREE.SphereGeometry(3, 32, 32);
      const sunMaterial = new THREE.MeshBasicMaterial({ map: suntexture });
      const sun = new THREE.Mesh(sunGeometry, sunMaterial);
      sun.position.set(2, 0, 0);

      // 太阳定向光
      const sunLight = new THREE.DirectionalLight(0xffffff, staticConfig.sunlightIntensity);
      sunLight.castShadow = true;
      sunLightRef.current = sunLight;

      // 阴影配置
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
      return sun;
    };

    /** @description 创建轨道 */
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
        opacity: 0.3
      });
      const orbit = new THREE.Mesh(orbitGeometry, orbitMaterial);
      orbitRef.current = orbit;

      // 轨道倾斜（黄赤夹角）
      orbit.rotation.x = Math.PI / 2;
      orbit.rotation.x -= THREE.MathUtils.degToRad(staticConfig.inclination);

      scene.add(orbit);
      addOrbitHelpers(orbit, scene);
      return orbit;
    };

    /** @description 轨道辅助线 */
    const addOrbitHelpers = (orbit: THREE.Mesh, scene: THREE.Scene) => {
      const majorAxis = new THREE.ArrowHelper(
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(-staticConfig.radius, 0, 0),
        staticConfig.radius * 2,
        0xff0000,
        0.5, 0.5
      );
      orbit.add(majorAxis);

      const minorAxis = new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, -staticConfig.radius, 0),
        staticConfig.radius * 2,
        0x00ff00,
        0.5, 0.5
      );
      orbit.add(minorAxis);
    };

    /** @description 创建节气辅助球体 */
    const createSolarTermsEarth = () => {
      const seasonGeometry = new THREE.SphereGeometry(1, 32, 32);
      const seasonMaterial = new THREE.MeshBasicMaterial({
        color: '#24758f',
        transparent: true,
        opacity: 0.2
      });

      return solarTerms.map(item => {
        const seasonMesh = new THREE.Mesh(seasonGeometry, seasonMaterial);
        seasonMesh.position.set(...getEarthPostiton(item.angle));
        seasonMesh.userData = item;
        scene.add(seasonMesh);
        return seasonMesh;
      });
    };

    const solarTermsEarthInstanceList = createSolarTermsEarth();

    /** @description 定义地球组相关参数（全局） */
    const EARTH_SCALE = 0.018; // 地球自身缩放

    /** @description 加载地球模型&创建经纬线&创建两级 */
    const loadEarth = () => {
      const loader = new GLTFLoader();
      loader.load(
        window.$$prefix + '/models/earth/scene.gltf',
        (gltf) => {
          const earthMesh = gltf.scene;

          // 地球纹理和材质
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

          // --- 创建地球组（核心：所有公转逻辑作用于组）---
          const earthGroup = new THREE.Group();

          earthGroup.name = 'EarthGroup';

          earthGroupRef.current = earthGroup; // 用earthGroupRef指向组（后续公转操作组）

          // 记录地球缩放值
          const earthScale = EARTH_SCALE;

          earthMesh.scale.set(earthScale, earthScale, earthScale);

          // 地球自转轴倾斜（仅影响地球自身）
          const axialTilt = THREE.MathUtils.degToRad(-23.5);

          earthMesh.rotation.x = axialTilt;

          // 将地球添加到组中
          earthGroup.add(earthMesh);

          const createDebugLatLonSphere = () => {
            const linesGroup = new THREE.Group();

            linesGroup.name = 'linesGroup';

            lineGroupRef.current = linesGroup;

            // 基础参数（保留您调试好的数值，确保与地球尺寸匹配）
            const baseSize = 1.5;                // 基础尺寸
            const distanceFromEarth = 0.002;     // 线条与地球表面距离
            const actualRadius = baseSize + distanceFromEarth; // 线条实际半径（含偏移）
            const axialTilt = THREE.MathUtils.degToRad(-23.5); // 地球自转轴倾斜角度（与地球一致）

            const latitudeWidth = 0.006;

            const latitudes = [
              {
                lat: 0,
                color: '#ff1030'
              },
              {
                lat: 23.5,
                color: '#f5f500'
              },
              {
                lat: 30,
                color: '#fff'
              },
              {
                lat: 60,
                color: '#fff'
              },
              {
                lat: -23.5,
                color: '#f5f500'
              },
              {
                lat: -30,
                color: '#fff'
              },
              {
                lat: -60,
                color: '#fff'
              },

            ]

            // 3. 纬线
            latitudes.forEach(latItem => {    // 北纬30°、60°，南纬30°、60°
              const latRad = THREE.MathUtils.degToRad(latItem.lat); // 纬度转弧度
              const latRadius = actualRadius * Math.cos(latRad); // 该纬度的圆周半径
              const latYPos = actualRadius * Math.sin(latRad);   // 该纬度的Y轴高度

              const latLine = new THREE.Mesh(
                new THREE.RingGeometry(
                  latRadius,                      // 内半径（该纬度的实际半径）
                  latRadius + latitudeWidth,          // 外半径（控制线宽）
                  128
                ),
                new THREE.MeshBasicMaterial({
                  color: latItem.color,                // 黄色区分纬线
                  side: THREE.DoubleSide,
                  transparent: false,
                  depthWrite: false
                })
              );
              latLine.position.y = latYPos;       // 定位到该纬度的Y轴高度
              latLine.rotation.x = Math.PI / 2;    // 旋转至水平平面

              latLine.name = `latitude-item-${latItem.lat}`;
              linesGroup.add(latLine);
            });

            // 4. 经线（多色区分，每30°一条，确保汇聚南北极）
            const longitudes = [
              {
                lon: 0,
                color: '#00b96b'
              },
              {
                lon: 30,
                color: '#fff'
              },
              {
                lon: 60,
                color: '#fff'
              },
              {
                lon: 90,
                color: '#fff'
              },
              {
                lon: 120,
                color: '#fff'
              },
              {
                lon: 150,
                color: '#fff'
              },
              {
                lon: 180,
                color: '#fff'
              },
              {
                lon: 210,
                color: '#fff'
              },
              {
                lon: 240,
                color: '#fff'
              },
              {
                lon: 270,
                color: '#fff'
              },
              {
                lon: 300,
                color: '#fff'
              },
              {
                lon: 330,
                color: '#fff'
              },
              {
                lon: 360,
                color: '#00b96b'
              }
            ]

            longitudes.forEach((lonItem, index) => {
              const lonRad = THREE.MathUtils.degToRad(lonItem.lon); // 经度转弧度

              const meridian = new THREE.Mesh(
                new THREE.RingGeometry(
                  0,                                // 内半径=0（从极点中心出发）
                  actualRadius + 0.001,                    // 外半径=线条实际半径
                  128,
                  0,                                // 起始角度=0（沿X轴正方向）
                  Math.PI                           // 角度范围=π（覆盖南北极）
                ),
                new THREE.MeshBasicMaterial({
                  color: lonItem.color,    // 每条经线独立颜色
                  side: THREE.DoubleSide,
                  transparent: false,
                  depthWrite: false
                })
              );

              // 关键旋转逻辑：确保经线沿Y轴（南北极）分布，且汇聚极点
              meridian.rotation.z = Math.PI / 2;   // 第一步：绕Z轴转90°，线条沿Y轴方向
              meridian.rotation.x = Math.PI;   // 第二步：绕X轴转90°，线条立起（垂直赤道）
              meridian.rotation.y = lonRad;        // 第三步：绕Y轴转对应经度，定位到目标位置

              // 微小Z轴偏移：避免多条经线完全重叠（调试阶段关键）
              meridian.position.z = 0.0001 * index;

              meridian.name = `longitude-item-${lonItem.lon}`;  // 命名便于调试
              linesGroup.add(meridian);
            });

            // 5. 极点标记（白色小球，直观验证经线是否汇聚）

            // 北极点标记
            const northPoleMarker = new THREE.Mesh(
              new THREE.SphereGeometry(0.015, 16, 16), // 小球尺寸，确保可见
              new THREE.MeshBasicMaterial({ color: 0xffffff }) // 白色高对比度
            );
            northPoleMarker.position.y = actualRadius; // 定位到北极点（Y轴正方向顶点）
            northPoleMarker.name = 'north-pole-marker';
            linesGroup.add(northPoleMarker);

            // 南极点标记
            const southPoleMarker = new THREE.Mesh(
              new THREE.SphereGeometry(0.015, 16, 16),
              new THREE.MeshBasicMaterial({ color: 0xffffff })
            );

            southPoleMarker.position.y = -actualRadius; // 定位到南极点（Y轴负方向顶点）
            southPoleMarker.name = 'south-pole-marker';
            linesGroup.add(southPoleMarker);

            // 6. 应用地球自转轴倾斜（与地球模型保持一致，确保空间角度正确）
            linesGroup.rotation.x = axialTilt;

            // 7. 最终缩放：确保线条完全包裹地球，且尺寸匹配
            linesGroup.scale.set(1.2, 1.2, 1.2);

            return linesGroup;
          };

          // 创建并添加经纬线（直接添加到场景根节点）
          const latLonLines = createDebugLatLonSphere();

          earthGroup.add(latLonLines);

          // 设置北极相机位置
          const observeEarthNorthPoleCameraPos = new THREE.Vector3(0.1, 3, -2);

          observeEarthNorthPoleCamera.position.copy(observeEarthNorthPoleCameraPos);

          observeEarthNorthPoleCamera.lookAt(earthGroup.position);

          earthGroup.add(observeEarthNorthPoleCamera);

          // 设置南极相机位置
          const observeEarthSouthPoleCameraPos = new THREE.Vector3(0.1, -3, 2);

          observeEarthSouthPoleCamera.position.copy(observeEarthSouthPoleCameraPos);

          observeEarthSouthPoleCamera.lookAt(earthGroup.position);

          earthGroup.add(observeEarthSouthPoleCamera);

          // --- 初始位置设置（组的位置决定公转轨道）---
          const initSolarTerm = solarTerms[guiConfigParamsRef.current.activeSolarTermsIndex];

          earthGroup.position.set(...getEarthPostiton(initSolarTerm.angle));

          // 添加到场景
          scene.add(earthGroup);

          // 初始化公转基准时间
          guiConfigParamsRef.current.revolutionStartTime = performance.now();
        },
        (xhr) => console.log(`地球加载中: ${(xhr.loaded / xhr.total * 100).toFixed(1)}%`),
        (error) => console.error('地球加载错误:', error)
      );
    };

    /** @description  创建 GUI 控制器 */
    const createGUI = () => {
      if (guiRef.current) guiRef.current.destroy();

      guiRef.current = new GUI();

      guiRef.current.title('参数控制');

      const params = guiConfigParamsRef.current;

      /* 公转控制 */
      const revolutionFolder = guiRef.current.addFolder('公转控制');

      // 2. 修复公转开关处理函数
      const handleRevolution = (val: boolean) => {
        const now = performance.now();
        const params = guiConfigParamsRef.current;

        if (!val) {
          // 暂停时：记录当前角度到baseAngle，确保后续计算基于此角度
          const elapsed = ((now) - params.revolutionStartTime) * 0.001;

          const currentDynamicAngle = params.baseAngle + -(elapsed / staticConfig.revolutionTime) * Math.PI * 2;

          params.baseAngle = currentDynamicAngle; // 关键：将当前动态角度固化为基准角度

          params.lastPauseStartTime = now;

          params.accumulatedSeconds = 0; // 重置累计时间，避免重复计算
        } else {
          // 开启时：基于当前基准角度（暂停时的角度）重新计算起始时间
          params.revolutionStartTime = now;
        }
      };

      // @ts-ignore
      revolutionGuiRef.current = revolutionFolder.add(params, 'isRevolution')
        .name('是否开启公转')
        .onChange((val: boolean) => {
          handleRevolution(val)
        });

      // 1. 公转速度控制
      revolutionFolder.add(params, 'revolutionTimeMutiple')
        .min(1).max(10).step(1)
        .name('公转速度倍数')
        .onFinishChange((val: number) => {
          staticConfig.revolutionTime = revolutionTimeInit / val;
        });

      /* 节气控制 */
      const solarTermsFolder = guiRef.current.addFolder('节气控制');

      const solarTermsOptions: Record<string, number> = {};

      solarTerms.forEach((item, index) => {
        solarTermsOptions[item.name] = index;
      });

      solarTermsFolder.add(params, 'activeSolarTermsIndex')
        .options(solarTermsOptions)
        .name('切换节气')
        .onChange((selectedIndex) => {
          const now = performance.now();
          const params = guiConfigParamsRef.current;

          // ① 强制停止公转
          params.isRevolution = false;
          handleRevolution(params.isRevolution); // 触发暂停逻辑，更新累计时间
          revolutionGuiRef.current!.updateDisplay();

          // ② 更新到目标节气的位置和角度
          // @ts-ignore
          const selectedSolarTerm = solarTerms[selectedIndex];

          const targetAngle = selectedSolarTerm.angle;

          if (earthGroupRef.current) {
            earthGroupRef.current.position.set(...getEarthPostiton(targetAngle));

            setObserveInnerEarthCameraPosition(targetAngle)
            setObserveOutEarthCameraPosition(targetAngle);
          }

          // ③ 关键：彻底重置公转时间参数，确保从新位置开始
          params.baseAngle = targetAngle; // 更新基准角度为当前节气
          params.accumulatedSeconds = 0; // 重置累计时间（新位置从零开始计算）
          params.revolutionStartTime = now; // 重置基准时间为当前时间
        });

      /* 光照控制 */
      const sunLightFolder = guiRef.current.addFolder('光照控制');

      sunLightFolder.add(params, 'sunlightIntensity')
        .min(0.1).max(3).step(0.1)
        .name('太阳光强度')
        .onFinishChange((val: number) => {
          sunLightRef.current!.intensity = val;
        });

      /* 相机控制 */
      const cameraFolder = guiRef.current.addFolder('相机控制');

      //5. 切换相机
      const cameraOptions: Record<string, number> = {};

      cameraInstanceList.forEach((item, index) => {
        cameraOptions[item.userData.name] = index;
      });

      cameraFolder.add(params, 'activeCameraIndex')
        .options(cameraOptions)
        .name('切换相机')


      /* 经纬线控制 */
      const lonAndLatFolder = guiRef.current.addFolder('经纬线控制&两极控制');

      lonAndLatFolder.add(params, 'showLatitudeLine')
        .name('是否显示纬线')
        .onChange((val: boolean) => {

          lineGroupRef.current!.children.forEach(child => {
            if (child.name.includes('latitude-item')) {
              child.visible = val;
            }
          })
        })

      lonAndLatFolder.add(params, 'showLongtitudeLine')
        .name('是否显示经线')
        .onChange((val: boolean) => {
          lineGroupRef.current!.children.forEach(child => {
            if (child.name.includes('longitude-item')) {
              child.visible = val;
            }
          })
        })
      lonAndLatFolder.add(params, 'showNorthPoleMarker')
        .name('是否显示北极点')
        .onChange((val: boolean) => {
          lineGroupRef.current!.children.forEach(child => {
            if (child.name.includes('north-pole-marker')) {
              child.visible = val;
            }
          })
        })

      lonAndLatFolder.add(params, 'showNSouthPoleMarker')
        .name('是否显示南极点')
        .onChange((val: boolean) => {
          lineGroupRef.current!.children.forEach(child => {
            if (child.name.includes('south-pole-marker')) {
              child.visible = val;
            }
          })
        })

    };

    /** @description 创建星系 */
    const createStars = () => {

      const textureLoader = new THREE.TextureLoader()

      const texture = textureLoader.load(window.$$prefix + '/textures/star_07.png')

      const count = 1000

      const geometry = new THREE.BufferGeometry()

      const positions = new Float32Array(count * 3)

      const colors = new Float32Array(count * 3)

      for (let i = 0; i < count * 3; i++) {

        positions[i] = (Math.random() - 0.5) * staticConfig.radius + (Math.random() * staticConfig.radius / 2)

        colors[i] = Math.random() * 10
      }

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

      const material = new THREE.PointsMaterial({
        size: 0.2,
        sizeAttenuation: true,
        color: '#ff88cc',
        transparent: true,
        alphaMap: texture,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true
      })

      const stars = new THREE.Points(geometry, material)

      scene.add(stars)
    };

    /** @description 初始化场景元素 */
    const todo = () => {
      createSun();
      createOrbit();
      loadEarth();
      createStars()
      createGUI();
    }


    todo()

    /* 12. 窗口大小调整 */
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

    const animate = (time: number) => {
      const params = guiConfigParamsRef.current;

      const elapsedSeconds = ((time) - params.revolutionStartTime) * 0.001;

      if (earthGroupRef.current && sunLightRef.current) {
        handleResize();

        // 计算当前角度（确保切换时连续）
        let currentAngle = params.baseAngle;

        if (params.isRevolution && elapsedSeconds >= 0) {

          // 开启公转时：在当前基准角度（暂停时的角度）基础上累加

          currentAngle = params.baseAngle + -(elapsedSeconds / staticConfig.revolutionTime) * Math.PI * 2;

          earthGroupRef.current.position.set(...getEarthPostiton(currentAngle));

          setObserveInnerEarthCameraPosition(currentAngle);

          setObserveOutEarthCameraPosition(currentAngle);
        }

        // 光照计算（基于连续的currentAngle，无突变）
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

        // 地球自转
        const earthMesh = earthRef.current;
        if (earthMesh) {
          earthMesh.rotation.y -= staticConfig.earthRotationSpeed;
        }
      }

      controls.update();
      renderer.render(scene, cameraInstanceList[params.activeCameraIndex]);
      requestAnimationFrame(animate);
    };

    /* 14. 启动动画和事件监听 */
    requestAnimationFrame(animate);
    window.addEventListener('resize', handleResize);

    /* 15. 清理函数 */
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer?.dispose();
      guiRef.current?.destroy();
    };
  };

  /* 组件挂载时初始化场景 */
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
