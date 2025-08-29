import React, { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'

type StarPropsType = {}

const StarRiver: React.FC<StarPropsType> = props => {
  const { } = props

  const canvasRef = useRef<HTMLCanvasElement>(null)

  const rendererRef = useRef<THREE.WebGLRenderer>(null)

  const initScene = () => {
    /* 渲染器 */
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current!,
      antialias: true,
      alpha: true,
    })

    renderer.setPixelRatio(window.devicePixelRatio)
    rendererRef.current = renderer

    /* 场景 */
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#000')

    /* 相机 */
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.set(0, 0, 5)
    camera.lookAt(0, 0, 0)

    /* 控制器 */
    const controls = new OrbitControls(camera, canvasRef.current)
    controls.enableDamping = true
    controls.target.set(0, 0, 0)
    controls.update()

    /* 世界坐标辅助器 */
    const axesHelper = new THREE.AxesHelper(5)
    scene.add(axesHelper)

    /* 星星 */

    const textureLoader = new THREE.TextureLoader()

    const texture = textureLoader.load(window.$$prefix + '/textures/star_07.png')

    const count = 2000

    const geometry = new THREE.BufferGeometry()

    const positions = new Float32Array(count * 3)

    const colors = new Float32Array(count * 3)

    for (let i = 0; i < count * 3; i++) {

      positions[i] = (Math.random() - 0.5) * 10

      colors[i] = Math.random() * 10
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const material = new THREE.PointsMaterial({
      size: 0.1,
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

    // 窗口大小调整
    const handleResize = () => {
      if (!canvasRef.current) return

      const { clientWidth: width, clientHeight: height } = canvasRef.current

      if (renderer.domElement.width !== width || renderer.domElement.height !== height) {
        renderer.setSize(width, height, false)

        camera.aspect = width / height

        camera.updateProjectionMatrix()
      }
    }

    function render(time: number) {
      const seconds = time * 0.001

      for (let i = 0; i < count; i++) {

        const i3 = i * 3

        const x = geometry.attributes.position.array[i3]

        // y
        geometry.attributes.position.array[i3 + 1] = Math.sin(x + seconds)
      }

      geometry.attributes.position.needsUpdate = true

      handleResize()

      controls.update()

      renderer.render(scene, camera)

      requestAnimationFrame(render)
    }

    requestAnimationFrame(render)

    window.addEventListener('resize', handleResize)

    return () => {
      renderer.dispose()
      window.removeEventListener('resize', handleResize)
    }
  }

  useEffect(() => {
    const cleanup = initScene()

    return cleanup
  }, [])

  return (
    <div className="canvas-container">
      <canvas className="canvas-body" ref={canvasRef}></canvas>
    </div>
  )
}

export default StarRiver