import React, { useEffect, useRef } from 'react'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import * as THREE from 'three'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";

type SkyPropsType = {}

const Sky: React.FC<SkyPropsType> = (props) => {
  const canvas = useRef<HTMLCanvasElement>(null)
  const guiRef = useRef<GUI>(null);

  const main = () => {
    if (!canvas.current) return

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      canvas: canvas.current
    })

    const scene = new THREE.Scene()

    // 初始相机宽高比使用canvas实际尺寸，而非window
    const { clientWidth, clientHeight } = canvas.current


    // 主相机
    const camera = new THREE.PerspectiveCamera(
      45,
      clientWidth / clientHeight,  // 关键：用canvas尺寸计算比例
      0.1,
      1000
    )

    camera.position.y = 0.5
    camera.position.z = 2

    // 主相机控制器
    const cameraControl = new OrbitControls(camera, canvas.current)
    cameraControl.enableDamping = true
    cameraControl.dampingFactor = 0.05

    // 画中画相机 - 视角不同
    const pipCamera = new THREE.PerspectiveCamera(
      60, // 不同的视角
      // 宽高比
      window.innerWidth / window.innerHeight, // the canvas default
      0.1,
      1000
    )
    pipCamera.position.set(1, 0, 5) // 不同的位置

    // 副相机控制器
    const pipCameraControl = new OrbitControls(pipCamera, canvas.current)
    pipCameraControl.enableDamping = true
    pipCameraControl.dampingFactor = 0.05
    pipCameraControl.autoRotate = true;

    // 画中画尺寸设置 (左下角，宽度为总宽度的1/4，保持4:3比例)
    const getPiPSize = () => {
      if (!canvas.current) return { x: 0, y: 0, width: 0, height: 0 }

      const { clientWidth, clientHeight } = canvas.current
      const pipWidth = Math.min(clientWidth / 4, 320) // 最大320px宽
      const pipHeight = pipWidth * 3 / 4 // 4:3比例

      // 左下角位置，带一点边距
      return {
        x: 20,
        y: clientHeight - pipHeight - 20,
        width: pipWidth,
        height: pipHeight
      }
    }


    // 添加环境贴图
    const rgbeLoader = new RGBELoader()
    rgbeLoader.load('/hdrs/sky.hdr', (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping
      scene.background = texture
      scene.environment = texture
    })


    // 添加世界坐标辅助器
    const axesHelper = new THREE.AxesHelper(5);

    scene.add(axesHelper);

    // 定向光源
    const color = 'rgba(101, 101, 101)'

    const intensity = 10

    const light = new THREE.DirectionalLight(color, intensity)

    light.position.set(10, 7, 7)

    scene.add(light)

    // 加载模型
    const gltfLoader = new GLTFLoader();

    const modelPath = '/models/duck/';

    gltfLoader.setPath(modelPath);

    const url = 'rubber_duck_toy_4k.gltf';

    let duck: THREE.Group<THREE.Object3DEventMap>

    gltfLoader.load(url, (gltf) => {

      duck = gltf.scene;

      scene.add(duck);
    });

    // 窗口大小调整
    const handleResize = () => {
      if (!canvas.current) return;
      const { clientWidth: width, clientHeight: height } = canvas.current;
      if (renderer.domElement.width !== width || renderer.domElement.height !== height) {
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    };

    // 初始强制调整一次尺寸（关键修复）
    handleResize()

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
    [camera, pipCamera].forEach((camera, index) => {
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

    function render(time: number) {
      if (!canvas.current) return

      time *= 0.001

      handleResize() // 每次渲染前检查尺寸

      // 1. 渲染主视图
      renderer.setViewport(0, 0, canvas.current!.clientWidth, canvas.current!.clientHeight)
      renderer.render(scene, cameraGuiControls.activeCameraIndex === 0 ? camera : pipCamera)

      // 2. 渲染画中画
      const pip = getPiPSize()
      renderer.setViewport(pip.x, pip.y, pip.width, pip.height)
      // 可以添加一个简单的背景
      renderer.setScissor(pip.x, pip.y, pip.width, pip.height)
      renderer.setScissorTest(true)
      renderer.render(scene, pipCamera)
      renderer.setScissorTest(false)

      cameraControl.update()
      pipCameraControl.update()

      requestAnimationFrame(render)
    }

    requestAnimationFrame(render)


    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      renderer?.dispose();

      if (!!guiRef.current) {
        guiRef.current.destroy();
        guiRef.current = null;
      }
    }
  }

  useEffect(() => {
    if (!canvas.current) return

    const clean = main()

    return clean
  }, [canvas.current])

  return (
    <div className="canvas-container" >
      {/* 确保canvas占满容器 */}
      <canvas
        className="canvas-body"
        ref={canvas}
      ></canvas>
    </div>
  )
}

export default Sky
