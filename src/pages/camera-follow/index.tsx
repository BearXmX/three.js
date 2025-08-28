
import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

type CameraFollowPropsType = {

}

const CameraFollow: React.FC<CameraFollowPropsType> = (props) => {

  const { } = props

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  const guiRef = useRef<GUI>(null);
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


    const cameraList = [] as THREE.PerspectiveCamera[]

    const makeCamera = () => {

      const fov = 45;
      const aspect = 2; // the canvas default
      const zNear = 0.1;
      const zFar = 1000;

      const c = new THREE.PerspectiveCamera(fov, aspect, zNear, zFar);

      cameraList.push(c)

      return c;
    };

    // 创建相机
    const camera = makeCamera()
    camera.position.set(30, 20, 30);
    camera.lookAt(0, 0, 0);

    // 创建场景
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#000');

    // 添加控制器
    const controls = new OrbitControls(camera, canvasRef.current);
    controls.enableDamping = true;

    // 添加世界坐标辅助器
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);

    const radiu = 5;

    // 创建一个球体
    const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);
    const sphereMaterial = new THREE.MeshBasicMaterial({ color: '#00b96b' });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.position.set(radiu, 0, 0);
    scene.add(sphere);

    // 创建相机2
    const sphereCamera = makeCamera()
    sphereCamera.position.set(10, 0, 10);
    sphereCamera.lookAt(0, 0, 0);


    // 创建相机3
    const sphereTopCamera = makeCamera()
    sphereTopCamera.position.set(0, 20, 0);
    sphereTopCamera.lookAt(0, 0, 0);

    // gui工具
    if (!!guiRef.current) {
      guiRef.current.destroy();
      guiRef.current = null;
    }

    guiRef.current = new GUI();

    const cameraGuiControls = {
      activeCameraIndex: 0,
    };

    const cameraGuiControlsOptions = {};

    // 相机控制参数
    cameraList.forEach((camera, index) => {
      // @ts-ignore
      cameraGuiControlsOptions[`相机${index + 1}`] = index;
    });


    guiRef
      .current!.add(cameraGuiControls, "activeCameraIndex")
      .options(cameraGuiControlsOptions)
      .name("切换相机视角")
      .onChange((val) => {
        cameraGuiControls.activeCameraIndex = val as number;
      });

    // 窗口大小调整
    const handleResize = () => {
      if (!canvasRef.current || !rendererRef.current) return;
      const { clientWidth: width, clientHeight: height } = canvasRef.current;
      if (rendererRef.current.domElement.width !== width || rendererRef.current.domElement.height !== height) {
        rendererRef.current.setSize(width, height, false);
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

    const sphereTarget = new THREE.Vector3();

    const animate = (time: number) => {
      if (!canvasRef.current) return

      const seconds = time * 0.001;

      handleResize();

      controls.update();

      /*       sphere.position.y = Math.PI / 180 * 45 * seconds / 5; */
      const angle = (seconds / 10) * Math.PI * 2;

      // sphere做圆周运动
      sphere.position.x = Math.cos(angle) * radiu;
      sphere.position.z = Math.sin(angle) * radiu;

      sphere.getWorldPosition(sphereTarget);


      cameraList[2].position.setX(sphere.position.x);
      cameraList[2].position.setZ(sphere.position.z);
      cameraList[2].updateMatrixWorld();

      cameraList[cameraGuiControls.activeCameraIndex].lookAt(sphereTarget);

      renderer.render(scene, cameraList[cameraGuiControls.activeCameraIndex]);

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);

    window.addEventListener('resize', handleResize);


    return () => {
      window.removeEventListener('resize', handleResize);
      renderer?.dispose();
      guiRef.current?.destroy();
    }
  }


  useEffect(() => {
    const clean = initScene()

    return clean
  }, [])

  return <div className='canvas-container'>

    <canvas className='canvas-body' ref={canvasRef}></canvas>

  </div>

}

export default CameraFollow