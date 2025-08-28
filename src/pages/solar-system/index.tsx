import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

const SolarSystem: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const earthRef = useRef<THREE.Group | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const orbitRef = useRef<THREE.Mesh | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null); // 太阳定向光引用
  const guiRef = useRef<GUI>(null);

  const orbitalPeriodInit = 10;

  // 轨道参数配置
  const orbitConfig = {
    radius: 15,          // 轨道半径
    orbitalPeriod: orbitalPeriodInit,   // 公转周期（秒/圈）
    inclination: 13.5,   // 轨道倾角（度）
    earthRotationSpeed: 0.02, // 自转速度
    sunlightIntensity: 1.5 // 太阳光强度
  };

  const initScene = () => {
    if (!canvasRef.current) return;

    // 创建渲染器
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    rendererRef.current = renderer;
    // 启用阴影效果
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 创建相机
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(30, 20, 30);
    camera.lookAt(0, 0, 0);

    // 创建场景
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050515);

    // 添加环境光（微弱，避免完全黑暗）
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
    scene.add(ambientLight);

    // 创建控制器
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0, 0);

    // 创建太阳
    const createSun = () => {
      const sunGeometry = new THREE.SphereGeometry(3, 32, 32);
      const sunMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff66,
      });
      const sun = new THREE.Mesh(sunGeometry, sunMaterial);
      sun.position.set(0, 0, 0); // 太阳在中心

      // 创建太阳定向光（核心：从太阳指向地球）
      const sunLight = new THREE.DirectionalLight(0xffffff, orbitConfig.sunlightIntensity);
      sunLight.castShadow = true; // 开启阴影投射
      sunLightRef.current = sunLight;

      // 配置阴影属性（使阴影更柔和）
      sunLight.shadow.mapSize.width = 2048;
      sunLight.shadow.mapSize.height = 2048;
      sunLight.shadow.camera.near = 5;
      sunLight.shadow.camera.far = 50;
      sunLight.shadow.camera.left = -20;
      sunLight.shadow.camera.right = 20;
      sunLight.shadow.camera.top = 20;
      sunLight.shadow.camera.bottom = -20;

      // 将光源添加到太阳上，使其随太阳移动（这里太阳不动）
      sun.add(sunLight);
      scene.add(sun);

      // 可选：添加光源辅助器，查看光照方向
      const sunLightHelper = new THREE.DirectionalLightHelper(sunLight, 2);
      sun.add(sunLightHelper);

      return sun;
    };

    // 创建倾斜轨道
    const createOrbit = () => {
      const orbitGeometry = new THREE.RingGeometry(
        orbitConfig.radius - 0.05,
        orbitConfig.radius + 0.1,
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

      orbit.rotation.x = Math.PI / 2;
      orbit.rotation.x -= THREE.MathUtils.degToRad(orbitConfig.inclination);

      scene.add(orbit);
      addOrbitHelpers(orbit, scene);

      return orbit;
    };

    // 添加轨道辅助线
    const addOrbitHelpers = (orbit: THREE.Mesh, scene: THREE.Scene) => {
      const majorAxis = new THREE.ArrowHelper(
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(-orbitConfig.radius, 0, 0),
        orbitConfig.radius * 2,
        0xff0000,
        0.5, 0.5
      );
      orbit.add(majorAxis);

      const minorAxis = new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, -orbitConfig.radius, 0),
        orbitConfig.radius * 2,
        0x00ff00,
        0.5, 0.5
      );
      orbit.add(minorAxis);
    };

    // 加载地球（开启接收阴影）
    const loadEarth = () => {
      const loader = new GLTFLoader();

      loader.load(
        '/models/earth/scene.gltf',
        (gltf) => {
          const earth = gltf.scene;
          earthRef.current = earth;

          // 地球纹理
          const textureLoader = new THREE.TextureLoader();
          const earthTexture = textureLoader.load(
            '/models/earth/textures/Material.002_diffuse.jpeg'
          );

          earth.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              // 配置材质接收阴影
              child.material = new THREE.MeshStandardMaterial({
                map: earthTexture,
                roughness: 0.8,
                metalness: 0.2,
                side: THREE.FrontSide
              });
              child.castShadow = true; // 地球投射阴影
              child.receiveShadow = true; // 地球接收阴影
            }
          });

          // 地球初始设置
          const earthScale = 0.018;
          earth.scale.set(earthScale, earthScale, earthScale);
          earth.rotation.z = THREE.MathUtils.degToRad(23.5);

          scene.add(earth);
        },
        (xhr) => console.log(`加载中: ${(xhr.loaded / xhr.total * 100)}%`),
        (error) => console.error('加载错误:', error)
      );
    };

    // 初始化场景
    createSun();
    createOrbit();
    loadEarth();

    // GUI控制
    if (guiRef.current) {
      guiRef.current.destroy();
      guiRef.current = null;
    }
    guiRef.current = new GUI();

    const orbitConfigParams = {
      orbitalPeriod: 1,
      sunlightIntensity: orbitConfig.sunlightIntensity
    };

    // 公转速度控制
    guiRef.current.add(orbitConfigParams, 'orbitalPeriod').min(1).max(10).step(1)
      .name('公转速度倍数').onChange((val: number) => {
        orbitConfig.orbitalPeriod = orbitalPeriodInit / val;
      });

    // 太阳光强度控制
    guiRef.current.add(orbitConfigParams, 'sunlightIntensity').min(0.1).max(3).step(0.1)
      .name('太阳光强度').onChange((val: number) => {
        if (sunLightRef.current) {
          sunLightRef.current.intensity = val;
        }
      });


    // 窗口大小调整
    const handleResize = () => {
      if (!canvasRef.current) return;

      const { clientWidth: width, clientHeight: height } = canvasRef.current;

      if (renderer.domElement.width !== width || renderer.domElement.height !== height) {

        renderer.setSize(width, height, false);

        camera.aspect = width / height;

        camera.updateProjectionMatrix();
      }
    };

    const setViewport = () => {

      // 画布大小调整
      const canvas = renderer.domElement;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const min = Math.min(width, height);
      const left = (width - min) / 2;
      const bottom = (height - min) / 2;

      renderer.setSize(width, height, false);
      // 1. 渲染主视图
      renderer.setViewport(0, 0, canvas!.clientWidth, canvas!.clientHeight)
    };

    // 动画循环（更新光源方向指向地球）
    const animate = (time: number) => {
      const seconds = time * 0.001;

      if (earthRef.current && sunLightRef.current) {

        handleResize();

        setViewport()
        // 计算地球位置
        const angle = (seconds / orbitConfig.orbitalPeriod) * Math.PI * 2;
        const inclineRad = THREE.MathUtils.degToRad(orbitConfig.inclination);
        const x = Math.cos(angle) * orbitConfig.radius;
        const y = Math.sin(angle) * orbitConfig.radius * Math.sin(inclineRad);
        const z = Math.sin(angle) * orbitConfig.radius * Math.cos(inclineRad);

        // 更新地球位置
        earthRef.current.position.set(x, y, z);
        earthRef.current.rotation.y -= orbitConfig.earthRotationSpeed;

        // 核心：让太阳光始终指向地球
        sunLightRef.current.target.position.copy(earthRef.current.position);
        sunLightRef.current.target.updateMatrixWorld();
      }

      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
    window.addEventListener('resize', handleResize);

    // 清理函数
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer?.dispose();
      if (guiRef.current) {
        guiRef.current.destroy();
      }
    };
  };

  useEffect(() => {
    const cleanup = initScene();
    return cleanup;
  }, []);

  return <div className='canvas-container'>

    <canvas className='canvas-body' ref={canvasRef}></canvas>

  </div>
};

export default SolarSystem;