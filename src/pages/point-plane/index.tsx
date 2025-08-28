
import React, { useState, useEffect, useRef } from 'react'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import * as THREE from 'three'

type PointPlanePropsType = {

}

const PointPlane: React.FC<PointPlanePropsType> = (props) => {
  const canvas = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const main = () => {
    // 渲染器
    const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas.current! })

    rendererRef.current = renderer


    // 视角
    const fov = 45

    // 宽高比
    const aspect = window.innerWidth / window.innerHeight  // the canvas default

    // 近平面
    const near = 0.1

    // 远平面
    const far = 1000

    // 相机
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far)

    camera.position.z = 20

    camera.position.x = 5

    camera.position.y = 5

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

    // 绘制地面
    {
      const planeSize = 40;
      const loader = new THREE.TextureLoader();
      const texture = loader.load('/checker.png');
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.magFilter = THREE.NearestFilter;
      texture.colorSpace = THREE.SRGBColorSpace;
      const repeats = planeSize / 2;
      texture.repeat.set(repeats, repeats);

      const planeGeo = new THREE.PlaneGeometry(planeSize, planeSize);

      const planeMat = new THREE.MeshPhongMaterial({
        map: texture,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(planeGeo, planeMat);
      mesh.rotation.x = Math.PI * - .5;
      scene.add(mesh);
    }


    // 自定义屏幕图形

    const params = [

      /* 这个是背面的三角形 */
      /*       {
              vertices: [
                0, 0, -2,
                0, 0, -4,
                0, 2, -3,
              ],
              color: '#ff0000',
              split: 3
            }, */


      {
        vertices: [
          -1, -1, 0,
          1, -1, 0,
          0, 1, 1,
        ],
        color: '#00b96b',
        split: 3
      },
      {
        vertices: [
          -1, -1, 2,
          1, -1, 2,
          0, 1, 1,
        ],
        color: '#4a208e',
        split: 3
      },
      {
        vertices: [
          -1, -1, 0,
          1, -1, 0,
          0, -3, 1,
        ],
        color: '#40a9ff',
        split: 3
      },

      {
        vertices: [
          -1, -1, 2,
          1, -1, 2,
          0, -3, 1,
        ],
        color: '#df17aa',
        split: 3
      },

      {
        vertices: [
          1, -1, 0,
          1, -1, 2,
          0, 1, 1,
        ],
        color: '#b70514',
        split: 3
      },

      {
        vertices: [
          1, -1, 0,
          1, -1, 2,
          0, -3, 1,
        ],
        color: '#89c73c',
        split: 3
      },

      {
        vertices: [
          -1, -1, 0,
          -1, -1, 2,
          0, -3, 1,
        ],
        color: '#212bd9',
        split: 3
      },

      {
        vertices: [
          -1, -1, 0,
          -1, -1, 2,
          0, 1, 1,
        ],
        color: '#dc691d',
        split: 3
      },
    ]

    const group = new THREE.Group()

    const planeInstance = params.map(item => {
      const geometry = new THREE.BufferGeometry()

      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(item.vertices), item.split))

      const material = new THREE.MeshBasicMaterial({
        color: item.color,
        // 控制是否两面绘制
        side: THREE.DoubleSide,

        // 控制线框展示
        wireframe: false,
      })

      const mesh = new THREE.Mesh(geometry, material)



      group.add(mesh)

      return mesh
    })

    scene.add(group)


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

      group.position.z = -(seconds * Math.PI / 180 * 50)

      controls.target.z = group.position.z + 2

      camera.position.x = 0

      camera.position.y = group.position.y + 2

      camera.position.z = group.position.z + 4

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

export default PointPlane