import React, { useState, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

type EarthPropsType = {}

const Earth: React.FC<EarthPropsType> = (props) => {

  const { } = props

  const canvas = useRef<HTMLCanvasElement>(null)

  const guiRef = useRef<GUI>(null)

  const main = () => {

    // 创建渲染器
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      canvas: canvas.current!,
    });

    // 视角
    const fov = 45

    // 宽高比
    const aspect = window.innerWidth / window.innerHeight // the canvas default

    // 近平面
    const near = 0.1

    // 远平面
    const far = 1000

    // 创建相机
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);

    camera.position.z = 500

    // 创建场景
    const scene = new THREE.Scene();

    const controls = new OrbitControls(camera, canvas.current!);

    controls.target.set(0, 5, 0);

    // 坐标系
    const axesHelper = new THREE.AxesHelper(50);

    scene.add(axesHelper);

    const gltfLoader = new GLTFLoader();

    const modelPath = '/models/earth/';

    gltfLoader.setPath(modelPath);

    const url = 'scene.gltf';

    let earth: THREE.Group<THREE.Object3DEventMap>

    gltfLoader.load(url, (gltf) => {

      earth = gltf.scene;

      const textureLoader = new THREE.TextureLoader();

      textureLoader.setPath(modelPath + 'textures/');

      // 加载所有需要的纹理
      const diffuseTexture = textureLoader.load('Material.002_diffuse.jpeg');

      earth.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const material = new THREE.MeshStandardMaterial({
            map: diffuseTexture,
            transparent: true,
            opacity: 1
          });
          child.material = material;
        }
      });

      scene.add(earth);
    });

    // 定向光源
    const color = 'rgba(101, 101, 101)'

    const intensity = 10

    const light = new THREE.DirectionalLight(color, intensity)

    light.position.set(10, 7, 7)

    scene.add(light)

    // gui工具
    if (!!guiRef.current) {
      guiRef.current.destroy();
      guiRef.current = null
    }

    guiRef.current = new GUI();

    guiRef.current!.addColor(light, 'color').name('Light Color').onChange(() => {
      light.color.set(light.color.getHex());
    });

    guiRef.current!.add(light, 'intensity').min(0).max(100).step(0.01).name('Light Intensity');

    const params = {
      positionX: 0,
      positionY: 0,
      positionZ: 0,
    };

    guiRef.current!.add(params, 'positionX').min(-500).max(500).step(1).name('Position X').onChange((val: number) => {
      earth.position.x = val;
    });

    guiRef.current!.add(params, 'positionY').min(-500).max(500).step(1).name('Position Y').onChange((val: number) => {
      earth.position.y = val;
    });

    guiRef.current!.add(params, 'positionZ').min(-500).max(500).step(1).name('Position Z').onChange((val: number) => {
      earth.position.z = val;
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

    function render(time: number) {
      if (!canvas.current) return;

      handleResize()

      const seconds = time * 0.001; // 将毫秒转换为秒

      controls.update();

      // 动画之类的操作

      if (earth) {
        earth.rotation.y = seconds * (Math.PI / 180 * 10);
      }

      renderer.render(scene, camera)

      requestAnimationFrame(render)
    }

    requestAnimationFrame(render)

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      renderer?.dispose();

      if (guiRef.current) {
        guiRef.current.destroy()
        guiRef.current = null
      }
    }


  }

  useEffect(() => {
    if (!canvas.current) return

    const clean = main()

    return clean
  }, [canvas.current])

  return <div className='canvas-container'>

    <canvas className='canvas-body' ref={canvas}></canvas>

  </div>

}

export default Earth