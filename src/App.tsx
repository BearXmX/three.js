import React, { useEffect, useRef } from 'react'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import './App.less'

import * as THREE from 'three'

const App: React.FC = () => {
  const canvas = useRef<HTMLCanvasElement>(null)

  const main = () => {
    // 渲染器
    const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas.current! })

    // 视角
    const fov = 75

    // 宽高比
    const aspect = window.innerWidth / window.innerHeight // the canvas default

    // 近平面
    const near = 0.1

    // 远平面
    const far = 1000

    // 相机
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far)

    camera.position.z = 10

    // 场景
    const scene = new THREE.Scene()

    const color = '#ffffff'

    const intensity = 10

    // 定向光源
    const light = new THREE.DirectionalLight(color, intensity)
    light.position.set(-1, 2, 1)
    scene.add(light)


    // 添加世界坐标辅助器
    const axesHelper = new THREE.AxesHelper(5);

    scene.add(axesHelper);

    // 导入控制器
    const controls = new OrbitControls(camera, canvas.current)
    // 设置带阻尼的惯性
    controls.enableDamping = true
    // 设置阻尼系数
    controls.dampingFactor = 0.05



    const boxWidth = 1
    const boxHeight = 1
    const boxDepth = 1

    // 绘制几何图形
    const geometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth)

    function makeInstance(geometry: THREE.BoxGeometry, color: string, x: number) {
      const material = new THREE.MeshPhongMaterial({ color })

      const cube = new THREE.Mesh(geometry, material)

      scene.add(cube)

      cube.position.x = x

      return cube
    }

    const cubes = [makeInstance(geometry, '#00b96b', 0), makeInstance(geometry, '#40a9ff', -2), makeInstance(geometry, '#95b12a', 2)]

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

      time *= 0.001

      cubes.forEach((cube, ndx) => {
        const speed = 1 + ndx * 0.1

        const rot = time * speed

        cube.rotation.x = rot

        cube.rotation.y = rot
      })

      renderer.render(scene, camera)

      // 更新控制器
      controls.update()
      requestAnimationFrame(render)
    }

    requestAnimationFrame(render)

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      renderer?.dispose();
    }
  }

  useEffect(() => {
    if (!canvas.current) return

    const clean = main()

    return clean
  }, [canvas.current])

  return (
    <div className="canvas-container">
      <canvas className="canvas-body" ref={canvas}></canvas>
    </div>
  )
}

export default App
