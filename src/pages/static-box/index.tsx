import React, { useEffect, useRef } from 'react'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import * as THREE from 'three'


type StaticBoxPropsType = {

}

const StaticBox: React.FC<StaticBoxPropsType> = (props) => {
  const canvas = useRef<HTMLCanvasElement>(null)

  const main = () => {
    // 渲染器
    const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas.current! })

    // 视角
    const fov = 85

    // 宽高比
    const aspect = window.innerWidth / window.innerHeight // the canvas default

    // 近平面
    const near = 0.1

    // 远平面
    const far = 5

    // 相机
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far)

    camera.position.z = 4

    // 场景
    const scene = new THREE.Scene()

    const color = '#ffffff'

    const intensity = 10

    // 定向光源
    const light = new THREE.DirectionalLight(color, intensity)

    // z为负数，表示光源朝向负z轴（背面）
    light.position.set(0, 1, 1)
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

    // 控制器自动旋转
    // controls.autoRotate = true

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

      cube.rotateX(0)

      return cube
    }

    const cubes = [makeInstance(geometry, '#00b96b', 0)]

    function resizeRendererToDisplaySize(renderer: THREE.WebGLRenderer) {
      const canvas = renderer.domElement

      const width = canvas.clientWidth

      const height = canvas.clientHeight

      const needResize = canvas.width !== width || canvas.height !== height

      if (needResize) {
        renderer.setSize(width, height, false)
      }

      return needResize
    }

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

    function render(time: number) {
      if (!canvas.current) return;

      handleResize()

      const seconds = time * 0.001; // 将毫秒转换为秒

      // 因为360度等于2π弧度，所以45度 = π/4弧度
      // 360度 === 2π   180度 === π  45度 === π/4  

      cubes.forEach((cube) => {
        cube.rotation.x = seconds * Math.PI / 4; // 例如，每秒旋转45度（π/4弧度）
      });


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

export default StaticBox