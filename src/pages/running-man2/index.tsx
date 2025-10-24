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

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1000)
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

    const sphereBody = new CANNON.Body({
      mass: 1,
      shape: new CANNON.Sphere(sphereRadius),
      position: new CANNON.Vec3(0, sphereRadius, 0),
      fixedRotation: true,
    })

    world.addBody(sphereBody)

    /** ===== 树（圆柱+圆锥） ===== */
    const obstacles: CANNON.Body[] = []
    for (let i = 0; i < 50; i++) {
      let x = 0, z = 0
      while (Math.sqrt(x * x + z * z) < 5) {
        x = (Math.random() - 0.5) * 100
        z = (Math.random() - 0.5) * 100
      }
      const trunkH = 0.8 + Math.random() * 1
      const crownH = 1.2 + Math.random() * 1
      const crownR = 0.6 + Math.random() * 0.5

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, trunkH, 8), new THREE.MeshPhongMaterial({ color: 0x8b4513 }))
      trunk.position.set(x, trunkH / 2, z)
      scene.add(trunk)

      const crown = new THREE.Mesh(new THREE.ConeGeometry(crownR, crownH, 8), new THREE.MeshPhongMaterial({ color: 0x228b22 }))
      crown.position.set(x, trunkH + crownH / 2, z)
      scene.add(crown)

      const box = new THREE.Box3()
      box.expandByObject(trunk)
      box.expandByObject(crown)
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

    /** ===== GLB 地形 ===== */
    let terrain: THREE.Object3D | null = null

    {
      // 生成一个不规则的曲线墙体
      // ===== 生成不规则曲线墙体 =====
      {
        const points = [{ x: 0, z: 0 }, { x: 2, z: 1 }, { x: 4, z: 0 }, { x: 6, z: 2 }, { x: 50, z: 0 }]
        for (let i = 0; i < points.length - 1; i++) {
          const p1 = points[i], p2 = points[i + 1]
          const dx = p2.x - p1.x, dz = p2.z - p1.z
          const length = Math.sqrt(dx * dx + dz * dz)
          const box = new THREE.Mesh(new THREE.BoxGeometry(length, 2, 0.5), new THREE.MeshPhongMaterial({ color: 'green' }))
          box.position.set((p1.x + p2.x) / 2, 1, (p1.z + p2.z) / 2)
          const angle = Math.atan2(dz, dx)
          box.rotation.y = -angle
          scene.add(box)

          const body = new CANNON.Body({ mass: 0 })
          body.addShape(new CANNON.Box(new CANNON.Vec3(length / 2, 1, 0.25)))
          body.position.set(box.position.x, box.position.y, box.position.z)
          body.quaternion.setFromEuler(box.rotation.x, box.rotation.y, box.rotation.z)
          world.addBody(body)
          obstacles.push(body)

        }
      }
    }

    {

      // 增加厚度的曲线墙
      const wallPoints: THREE.Vector3[] = []
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-5, 0, -5),
        new THREE.Vector3(-2, 0, 0),
        new THREE.Vector3(2, 0, 2),
        new THREE.Vector3(5, 0, 5)
      ])
      const points = curve.getPoints(20)

      const wallHeight = 2
      const wallThickness = 0.5
      points.forEach((p, i) => {
        if (i < points.length - 1) {
          const next = points[i + 1]
          const dir = new THREE.Vector3().subVectors(next, p)
          const length = dir.length()
          dir.normalize()

          // Box 沿两点方向放置，长度=段长，厚度=wallThickness
          const angle = Math.atan2(dir.z, dir.x)
          const wallGeom = new THREE.BoxGeometry(length, wallHeight, wallThickness)
          const wallMesh = new THREE.Mesh(wallGeom, new THREE.MeshPhongMaterial({ color: '#00b96b' }))

          wallMesh.position.set((p.x + next.x) / 2, wallHeight / 2, (p.z + next.z) / 2)
          wallMesh.rotation.y = -angle
          scene.add(wallMesh)

          // 对应刚体
          const body = new CANNON.Body({ mass: 0 })
          const halfExtents = new CANNON.Vec3(length / 2, wallHeight / 2, wallThickness / 2)
          body.addShape(new CANNON.Box(halfExtents))
          body.position.set(wallMesh.position.x, wallMesh.position.y, wallMesh.position.z)
          body.quaternion.setFromEuler(0, wallMesh.rotation.y, 0)
          world.addBody(body)
          obstacles.push(body)
        }
      })

    }

    /**
 * 将 THREE.Mesh 转成 Cannon.js 静态刚体（Trimesh）
 * @param mesh THREE.Mesh 对象（不规则墙体）
 * @returns CANNON.Body 静态刚体
 */
    function meshToTrimeshBody(mesh: THREE.Mesh): CANNON.Body {
      if (!mesh.geometry) throw new Error('Mesh must have geometry')

      const geom = mesh.geometry as THREE.BufferGeometry
      geom.computeVertexNormals() // 确保法线

      const vertices: number[] = []
      const indices: number[] = []

      // 顶点数组
      const posAttr = geom.attributes.position
      for (let i = 0; i < posAttr.count; i++) {
        vertices.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i))
      }

      // 索引数组
      if (geom.index) {
        for (let i = 0; i < geom.index.count; i++) {
          indices.push(geom.index.getX(i))
        }
      } else {
        // 没有索引就按顺序每三个顶点为一个三角形
        for (let i = 0; i < posAttr.count; i += 3) {
          indices.push(i, i + 1, i + 2)
        }
      }

      // 创建 Trimesh
      const shape = new CANNON.Trimesh(vertices, indices)
      const body = new CANNON.Body({ mass: 0 }) // 静态刚体
      body.addShape(shape)

      // 保持位置和旋转与 Mesh 一致
      body.position.set(mesh.position.x, mesh.position.y, mesh.position.z)
      body.quaternion.set(mesh.quaternion.x, mesh.quaternion.y, mesh.quaternion.z, mesh.quaternion.w)

      return body
    }


    const loader = new GLTFLoader()

    loader.load(
      window.$$prefix + '/models/running/running.glb',
      gltf => {
        terrain = gltf.scene
        terrain.position.set(0, 0, 0)
        scene.add(terrain)
        const wallKeys = [] as any[]// 特殊 Mesh 名称

        terrain.traverse(obj => {
          if (obj instanceof THREE.Mesh) {
            const box = new THREE.Box3().setFromObject(obj)
            const size = new THREE.Vector3()
            const center = new THREE.Vector3()
            box.getSize(size)
            box.getCenter(center)

            let body: CANNON.Body

            if (obj instanceof THREE.Mesh && obj.material?.name === '01010101') {
              body = new CANNON.Body({
                mass: 0,
                shape: new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)),
                position: new CANNON.Vec3(center.x, center.y, center.z),
              })
              world.addBody(body)
              obstacles.push(body)
            }

            if (obj instanceof THREE.Mesh && obj?.name === 'mesh_0_5') {

              const wallMesh: THREE.Mesh = obj // 你的不规则墙体 Mesh
              const wallBody = meshToTrimeshBody(wallMesh)
              world.addBody(wallBody)
              obstacles.push(wallBody)
            }
          }
        })
      },
      undefined,
      err => console.error('GLB加载失败:', err)
    )

    /** ===== 键盘控制 ===== */
    const move = { forward: 0, backward: 0, left: 0, right: 0 }

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
    const speed = 5


    const animate = () => {
      requestAnimationFrame(animate)

      // 水平移动
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

        // 设置水平速度
        sphereBody.velocity.x = moveVec.x
        sphereBody.velocity.z = moveVec.z


      } else {
        sphereBody.velocity.x = 0
        sphereBody.velocity.z = 0
      }

      // 上坡下坡同步 Y 位置
      if (terrain) {
        raycaster.set(sphere.position.clone().add(new THREE.Vector3(0, 10, 0)), down)
        const hits = raycaster.intersectObject(terrain, true)
        if (hits.length > 0) {
          const targetY = hits[0].point.y + sphereRadius
          sphere.position.y += (targetY - sphere.position.y) * 0.1
          sphereBody.position.y = sphere.position.y
        } else {
          sphere.position.y = sphereRadius
          sphereBody.position.y = sphere.position.y
        }
      }

      // 更新 Three.js 球体位置
      sphere.position.x = sphereBody.position.x
      sphere.position.z = sphereBody.position.z

      // 相机跟随
      const camDir = new THREE.Vector3()
      camera.getWorldDirection(camDir)
      camDir.y = 0
      camDir.normalize()
      const desiredPos = sphere.position.clone().add(camDir.clone().multiplyScalar(-cameraOffset.z)).add(new THREE.Vector3(0, cameraOffset.y, 0))
      camera.position.lerp(desiredPos, 0.1)
      controls.target.lerp(sphere.position, 0.1)
      controls.update()

      // 步进物理世界
      world.step(1 / 60)

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
