import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BooleanController, GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

const SolarSystem: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const earthRef = useRef<THREE.Group | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const orbitRef = useRef<THREE.Mesh | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
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

    activeCameraIndex: activeCameraIndexInit
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

    const createCamera = (base: [fov: number, aspect: number, near: number, far: number], position: [x: number, y: number, z: number], name: string) => {
      const camera = new THREE.PerspectiveCamera(...base);

      camera.position.set(...position);

      camera.lookAt(0, 0, 0);

      camera.userData.name = name;

      cameraInstanceList.push(camera);

      scene.add(camera);

      return camera;
    };

    const mainCamera = createCamera([75, window.innerWidth / window.innerHeight, 0.1, 1000], [5, 20, 20], '主相机')

    const observeInnerEarthCamera = createCamera([45, window.innerWidth / window.innerHeight, 0.1, 1000], [0, 0, 0], '观察内圈地球相机')

    const observeOutEarthCamera = createCamera([45, window.innerWidth / window.innerHeight, 0.1, 1000], [0, 0, 0], '观察外圈地球相机')

    /*     const observeInnerEarthCameraHelper = new THREE.CameraHelper(observeInnerEarthCamera);
        
        scene.add(observeInnerEarthCameraHelper); */

    const setObserveInnerEarthCameraPosition = (targetAngle: number) => {
      const observeInnerEarthCameraPosition = getEarthPostiton(targetAngle, 2);

      observeInnerEarthCameraPosition[1] = earthRef.current!.position.y;

      observeInnerEarthCamera.position.set(...observeInnerEarthCameraPosition);

      observeInnerEarthCamera.lookAt(earthRef.current!.position);
    }

    const setObserveOutEarthCameraPosition = (targetAngle: number) => {
      const observeOutEarthCameraPosition = getEarthPostiton(targetAngle, staticConfig.radius * 2);

      observeOutEarthCameraPosition[1] = earthRef.current!.position.y;

      observeOutEarthCamera.position.set(...observeOutEarthCameraPosition);

      observeOutEarthCamera.lookAt(earthRef.current!.position);
    }

    /* 3. 灯光和控制器 */
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
    scene.add(ambientLight);

    const controls = new OrbitControls(mainCamera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0, 0);

    /* 4. 辅助元素 */
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);

    /* 5. 创建太阳 */
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

    /* 6. 创建轨道 */
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

    /* 7. 轨道辅助线 */
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

    /* 8. 创建节气辅助球体 */
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

    /* 9. 加载地球模型 */
    const loadEarth = () => {
      const loader = new GLTFLoader();
      loader.load(
        window.$$prefix + '/models/earth/scene.gltf',
        (gltf) => {
          const earth = gltf.scene;
          earthRef.current = earth;

          // 地球纹理和材质
          const textureLoader = new THREE.TextureLoader();
          const earthTexture = textureLoader.load(
            window.$$prefix + '/models/earth/textures/Material.002_diffuse.jpeg'
          );
          earth.traverse((child) => {
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

          // 地球缩放和自转轴倾斜
          const earthScale = 0.018;

          earth.scale.set(earthScale, earthScale, earthScale);

          earth.rotation.x = THREE.MathUtils.degToRad(-23.5);

          // 初始位置：春分
          const initSolarTerm = solarTerms[guiConfigParamsRef.current.activeSolarTermsIndex];

          earth.position.set(...getEarthPostiton(initSolarTerm.angle));

          setObserveInnerEarthCameraPosition(initSolarTerm.angle);
          setObserveOutEarthCameraPosition(initSolarTerm.angle);

          // 初始化公转基准时间
          guiConfigParamsRef.current.revolutionStartTime = performance.now();

          scene.add(earth);
        },
        (xhr) => console.log(`地球加载中: ${(xhr.loaded / xhr.total * 100).toFixed(1)}%`),
        (error) => console.error('地球加载错误:', error)
      );
    };

    /* 10. 创建 GUI 控制器 */
    const createGUI = () => {
      if (guiRef.current) guiRef.current.destroy();
      guiRef.current = new GUI();
      const params = guiConfigParamsRef.current;

      // 1. 公转速度控制
      guiRef.current.add(params, 'revolutionTimeMutiple')
        .min(1).max(10).step(1)
        .name('公转速度倍数')
        .onFinishChange((val: number) => {
          staticConfig.revolutionTime = revolutionTimeInit / val;
        });

      // 2. 太阳光强度控制
      guiRef.current.add(params, 'sunlightIntensity')
        .min(0.1).max(3).step(0.1)
        .name('太阳光强度')
        .onFinishChange((val: number) => {
          sunLightRef.current!.intensity = val;
        });


      // 2. 修复公转开关处理函数
      const handleRevolution = (val: boolean) => {
        const now = performance.now();
        const params = guiConfigParamsRef.current;

        if (!val) {
          // 暂停时：记录当前累计时间
          params.lastPauseStartTime = now;
          // 计算到暂停时的总公转时间
          const elapsed = ((now) - params.revolutionStartTime) * 0.001;
          params.accumulatedSeconds = Math.max(0, elapsed);
        } else {
          // 重启时：基于当前基准角度和累计时间重新计算

          // 关键：以当前时间为基准，减去已累计的时间，确保从当前位置开始
          params.revolutionStartTime = now - params.accumulatedSeconds * 1000;
        }
      };


      // @ts-ignore
      revolutionGuiRef.current = guiRef.current.add(params, 'isRevolution')
        .name('是否开启公转')
        .onChange((val: boolean) => {
          handleRevolution(val)
        });

      // 4. 节气切换（核心修改）
      const solarTermsOptions: Record<string, number> = {};

      solarTerms.forEach((item, index) => {
        solarTermsOptions[item.name] = index;
      });

      guiRef.current.add(params, 'activeSolarTermsIndex')
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

          if (earthRef.current) {
            earthRef.current.position.set(...getEarthPostiton(targetAngle));

            setObserveInnerEarthCameraPosition(targetAngle)
            setObserveOutEarthCameraPosition(targetAngle);
          }

          // ③ 关键：彻底重置公转时间参数，确保从新位置开始
          params.baseAngle = targetAngle; // 更新基准角度为当前节气
          params.accumulatedSeconds = 0; // 重置累计时间（新位置从零开始计算）
          params.revolutionStartTime = now; // 重置基准时间为当前时间

          console.log(`切换到${selectedSolarTerm.name}，已重置公转基准`);
        });

      //5. 切换相机
      const cameraOptions: Record<string, number> = {};

      cameraInstanceList.forEach((item, index) => {
        cameraOptions[item.userData.name] = index;
      });

      guiRef.current.add(params, 'activeCameraIndex')
        .options(cameraOptions)
        .name('切换相机')
    };

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

    /* 11. 初始化场景元素 */
    createSun();
    createOrbit();
    loadEarth();
    createGUI();
    createStars()

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

      if (earthRef.current && sunLightRef.current) {
        handleResize();

        // 存储当前地球公转角度（用于光照计算）
        let currentAngle = params.baseAngle;

        if (params.isRevolution && elapsedSeconds >= 0) {
          // 计算当前公转角度
          currentAngle = params.baseAngle + -(elapsedSeconds / staticConfig.revolutionTime) * Math.PI * 2;
          earthRef.current.position.set(...getEarthPostiton(currentAngle));
          setObserveInnerEarthCameraPosition(currentAngle);
          setObserveOutEarthCameraPosition(currentAngle);
        }

        // 地球自转
        earthRef.current.rotation.y -= staticConfig.earthRotationSpeed;

        // 核心修正：调整角度相位，确保初始值为0
        // 1. 标准化角度到 0 ~ 2π 范围
        const normalizedAngle = (currentAngle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);

        // 2. 关键修正：增加 π/2 相位偏移，使周期从0开始
        // 修正后对应关系：
        // 0 → 0 → 春分（偏移0）
        // π/2 → 1 → 夏至（偏移12）
        // π → 0 → 秋分（偏移0）
        // 3π/2 → -1 → 冬至（偏移-12）
        const adjustedAngle = normalizedAngle + Math.PI / 2; // 相位补偿
        const sinValue = Math.sin(adjustedAngle);

        // 3. 映射到目标偏移范围（0 → 12 → 0 → -12）
        const maxOffset = 12;
        const lightOffsetY = sinValue * maxOffset;

        // 应用光照偏移
        sunLightRef.current.target.position.set(
          earthRef.current.position.x,
          earthRef.current.position.y + lightOffsetY,
          earthRef.current.position.z
        );
        sunLightRef.current.target.updateMatrixWorld();
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
