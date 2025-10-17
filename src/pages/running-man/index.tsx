import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as CANNON from 'cannon-es'

const RunningMan: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    /** ===== THREE.js 初始化 ===== */
    const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvasRef.current })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(window.devicePixelRatio)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x87ceeb)

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.position.set(0, 3, 6)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.target.set(0, 0.5, 0)
    controls.maxPolarAngle = Math.PI / 2.05
    controls.enablePan = false

    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const dirLight = new THREE.DirectionalLight(0xffffff, 1)
    dirLight.position.set(10, 10, 5)
    scene.add(dirLight)

    /** ===== Cannon.js 世界 ===== */
    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) })

    /** ===== 球体 ===== */
    const sphereRadius = 0.5
    const sphereGeo = new THREE.SphereGeometry(sphereRadius, 32, 32)
    const sphereMat = new THREE.MeshPhongMaterial({ color: 0xff0000 })
    const sphere = new THREE.Mesh(sphereGeo, sphereMat)
    scene.add(sphere)
    sphere.position.set(0, sphereRadius, 0)

    /** 球体虚拟刚体（用于检测障碍物） */
    const sphereBody = new CANNON.Body({ mass: 0 })
    sphereBody.position.set(0, sphereRadius, 0)

    /** ===== 树（圆柱+圆锥） ===== */
    const obstacles: CANNON.Body[] = []
    for (let i = 0; i < 50; i++) {
      let x = 0,
        z = 0
      while (Math.sqrt(x * x + z * z) < 5) {
        x = (Math.random() - 0.5) * 100
        z = (Math.random() - 0.5) * 100
      }
      const trunkH = 0.8 + Math.random() * 1
      const crownH = 1.2 + Math.random() * 1
      const crownR = 0.6 + Math.random() * 0.5

      // 树干
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, trunkH, 8), new THREE.MeshPhongMaterial({ color: 0x8b4513 }))
      trunk.position.set(x, trunkH / 2, z)
      scene.add(trunk)

      // 树冠
      const crown = new THREE.Mesh(new THREE.ConeGeometry(crownR, crownH, 8), new THREE.MeshPhongMaterial({ color: 0x228b22 }))
      crown.position.set(x, trunkH + crownH / 2, z)
      scene.add(crown)

      // 计算整个树的包围盒
      const box = new THREE.Box3()
      box.expandByObject(trunk)
      box.expandByObject(crown)
      const size = new THREE.Vector3()
      const center = new THREE.Vector3()
      box.getSize(size)
      box.getCenter(center)

      // 创建碰撞体
      const body = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)),
        position: new CANNON.Vec3(center.x, center.y, center.z),
      })
      world.addBody(body)
      obstacles.push(body)
    }

    /** ===== GLB 地形 ===== */
    let terrain: THREE.Object3D | null = null
    const loader = new GLTFLoader()
    loader.load(
      window.$$prefix + '/models/running/running.glb',
      gltf => {
        terrain = gltf.scene
        terrain.position.set(0, 0, 0)
        scene.add(terrain)

        terrain.traverse(obj => {
          if (obj instanceof THREE.Mesh && obj.material?.name === '01010101') {
            const box = new THREE.Box3().setFromObject(obj)
            const size = new THREE.Vector3()
            const center = new THREE.Vector3()
            box.getSize(size)
            box.getCenter(center)

            const body = new CANNON.Body({
              mass: 0,
              shape: new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)),
              position: new CANNON.Vec3(center.x, center.y, center.z),
            })

            world.addBody(body)
            obstacles.push(body)
          }
        })
      },
      undefined,
      err => console.error('GLB加载失败:', err)
    )

    /** ===== 键盘控制 ===== */
    const move = { forward: 0, backward: 0, left: 0, right: 0 }
    const speed = 0.1
    window.addEventListener('keydown', e => {
      if (e.key === 'w') move.forward = 1
      if (e.key === 's') move.backward = 1
      if (e.key === 'a') move.left = 1
      if (e.key === 'd') move.right = 1
    })
    window.addEventListener('keyup', e => {
      if (e.key === 'w') move.forward = 0
      if (e.key === 's') move.backward = 0
      if (e.key === 'a') move.left = 0
      if (e.key === 'd') move.right = 0
    })

    /** ===== Raycaster 上坡下坡 ===== */
    const raycaster = new THREE.Raycaster()
    const down = new THREE.Vector3(0, -1, 0)

    /** ===== 动画循环 ===== */
    const cameraOffset = new THREE.Vector3(0, 1.5, 3)
    const animate = () => {
      requestAnimationFrame(animate)

      // 球体移动向量
      const dir = new THREE.Vector3(move.right - move.left, 0, move.backward - move.forward)
      if (dir.lengthSq() > 0) {
        dir.normalize()
        const camDir = new THREE.Vector3()
        camera.getWorldDirection(camDir)
        camDir.y = 0
        camDir.normalize()
        const rightVec = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize()
        const moveVec = new THREE.Vector3()
        moveVec.addScaledVector(camDir, -dir.z * speed)
        moveVec.addScaledVector(rightVec, dir.x * speed)

        // 检测障碍物碰撞（球体半径 + box 近似）
        const newPos = sphere.position.clone().add(moveVec)
        let blocked = false
        const COLLISION_PADDING = 0.01 // 调小碰撞距离，越小越容易靠近

        obstacles.forEach(obs => {
          const shape = obs.shapes[0]

          if (shape instanceof CANNON.Box) {
            const obsPos = new THREE.Vector3(obs.position.x, obs.position.y, obs.position.z)

            const half = shape.halfExtents
            if (
              Math.abs(newPos.x - obsPos.x) < sphereRadius + half.x - COLLISION_PADDING &&
              Math.abs(newPos.y - obsPos.y) < sphereRadius + half.y - COLLISION_PADDING &&
              Math.abs(newPos.z - obsPos.z) < sphereRadius + half.z - COLLISION_PADDING
            ) {
              blocked = true
            }
          }
        })

        if (!blocked) sphere.position.add(moveVec)
      }

      // 上坡下坡
      if (terrain) {
        raycaster.set(sphere.position.clone().add(new THREE.Vector3(0, 10, 0)), down)
        const hits = raycaster.intersectObject(terrain, true)
        if (hits.length > 0) {
          const targetY = hits[0].point.y + sphereRadius
          sphere.position.y += (targetY - sphere.position.y) * 0.25
        } else {
          sphere.position.y = sphereRadius
        }
      }

      // 相机跟随
      const camDir = new THREE.Vector3()
      camera.getWorldDirection(camDir)
      camDir.y = 0
      camDir.normalize()
      const desiredPos = sphere.position.clone().add(camDir.clone().multiplyScalar(-cameraOffset.z)).add(new THREE.Vector3(0, cameraOffset.y, 0))
      camera.position.lerp(desiredPos, 0.1)
      controls.target.lerp(sphere.position, 0.1)
      controls.update()

      renderer.render(scene, camera)
    }

    animate()

    // 窗口自适应
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      renderer.dispose()
    }
  }, [])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100vh', display: 'block' }} />
}

export default RunningMan
