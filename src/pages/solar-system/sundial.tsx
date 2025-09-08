import React, { useEffect, useRef } from 'react'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import * as THREE from 'three'


type SundialPropsType = {
  params: {
    latitudePosition: number,
    longitudePosition: number
    currentTimeStr: string
    targetPositionCurrentTimeStr: string
  }
}

const Sundial: React.FC<SundialPropsType> = (props) => {
  const { params } = props

  const canvas = useRef<HTMLCanvasElement>(null)
  const currentTimeSpanRef = useRef<HTMLSpanElement>(null)
  const targetTimeSpanRef = useRef<HTMLSpanElement>(null)

  const shadowRef = useRef<THREE.Mesh | null>(null)
  const cylinderGroupRef = useRef<THREE.Group | null>(null)

  // 常量定义
  const CYLINDER_RADIUS = 3
  const CYLINDER_THICKNESS = 1
  const CENTER_Y = CYLINDER_THICKNESS / 2 // 圆柱中心Y坐标
  const BASE_SHADOW_LENGTH = CYLINDER_RADIUS * 0.25  // 基础保留长度（19-6点）
  const MAX_SHADOW_LENGTH = CYLINDER_RADIUS * 2.5  // 最大长度（13点）
  const INITIAL_24H_ANGLE = -Math.PI / 2; // 24点初始角度（-90°）

  const main = () => {
    if (!canvas.current) return

    // 1. 渲染器配置
    const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas.current })
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.sortObjects = true

    // 2. 相机配置
    const camera = new THREE.PerspectiveCamera(85, 1, 0.1, 300)
    camera.position.set(0, 7, 6)

    // 3. 场景与光源
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a2e) // 深色背景
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5)
    scene.add(ambientLight)

    // 4. 辅助轴
    const axesHelper = new THREE.AxesHelper(3)
    scene.add(axesHelper)

    // 5. 控制器
    const controls = new OrbitControls(camera, canvas.current)
    controls.enableDamping = true

    // 主容器组
    const riGuiGroup = new THREE.Group()
    const boxHeight = 1 // 底座高度


    // ---------------------- 组件1：创建底座 ----------------------
    const createBox = () => {
      const texture = new THREE.TextureLoader().load(`${window.$$prefix}/textures/concrete_floor_worn_001_diff_1k.jpg`)
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(8, boxHeight, 8),
        new THREE.MeshStandardMaterial({
          color: '#b3b3b3',
          map: texture,
          side: THREE.DoubleSide
        })
      )
      box.position.set(0, boxHeight / 2, 0)
      riGuiGroup.add(box)
    }


    // ---------------------- 组件2：创建刻度盘（圆柱组） ----------------------
    const createCylinder = () => {
      const long = 0.5
      const cylinderGroup = new THREE.Group()

      // 圆柱本体
      const cylinder = new THREE.Mesh(
        new THREE.CylinderGeometry(CYLINDER_RADIUS, CYLINDER_RADIUS, CYLINDER_THICKNESS, 32),
        new THREE.MeshStandardMaterial({
          color: '#a1a1a1',
          transparent: true,
          opacity: 0.9
        })
      )
      cylinder.position.set(0, 0, 0)
      cylinderGroup.add(cylinder)

      // ---------------------- 影子创建 ----------------------
      const shadowGeometry = new THREE.BoxGeometry(long, 0.02, 0.2)
      shadowGeometry.translate(-long / 2, 0, 0) // 原点移至一端（根部在中心，单向延伸）

      const shadow = new THREE.Mesh(
        shadowGeometry,
        new THREE.MeshStandardMaterial({
          color: 0x000000,
          transparent: true,
          opacity: 0.4,
          depthWrite: false
        })
      )

      // 影子初始配置
      shadow.position.set(0, CENTER_Y, 0) // 根部固定在圆柱中心
      shadow.scale.x = BASE_SHADOW_LENGTH // 初始用基础长度
      shadow.rotation.y = INITIAL_24H_ANGLE // 默认指向24点（-90°）

      cylinderGroup.add(shadow)
      shadowRef.current = shadow


      // 刻度线（24小时制）
      const markerGroup = new THREE.Group()
      for (let i = 0; i < 24; i++) {
        const angle = (i * 15) * (Math.PI / 180) // 每小时15度
        const x = Math.cos(angle) * CYLINDER_RADIUS
        const y = Math.sin(angle) * CYLINDER_RADIUS

        const marker = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.05, 0.05),
          new THREE.MeshStandardMaterial({ color: 0x333333 })
        )
        marker.position.set(
          (x + Math.cos(angle) * 0.25) / 1.2,
          (y + Math.sin(angle) * 0.25) / 1.2,
          -0.5
        )
        marker.rotation.z = angle
        markerGroup.add(marker)
      }
      markerGroup.rotation.x = Math.PI / 2 // 刻度盘平躺
      cylinderGroup.add(markerGroup)

      riGuiGroup.add(cylinderGroup)
      cylinderGroupRef.current = cylinderGroup
      return cylinderGroup
    }


    // ---------------------- 组件3：创建晷针 ----------------------
    const createGnomon = (parentGroup: THREE.Group) => {
      const gnomon = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 1.5, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x8b4513 })
      )
      gnomon.position.set(0, 0.75, 0) // 位于圆柱中心
      parentGroup.add(gnomon)
    }


    // ---------------------- 核心修改：按新时间段动态计算影子长度 ----------------------
    const updateShadow = (time: string) => {
      const shadow = shadowRef.current
      if (!shadow) return

      // 1. 解析时间（24小时制容错处理）
      const [hours = 0, minutes = 0] = time.split(':')
        .map(Number)
        .filter(num => !isNaN(num) && num >= 0)
      const validHours = Math.max(0, Math.min(23, hours))
      const validMinutes = Math.max(0, Math.min(59, minutes))
      const totalHours = validHours + validMinutes / 60 // 转换为小数小时（0-23.99）

      // 2. 按新时间段计算影子长度（核心修改部分）
      let dynamicShadowLength = BASE_SHADOW_LENGTH // 默认用基础长度

      if (totalHours >= 6 && totalHours < 13) {
        // 6点-13点：递增（从BASE到MAX，线性插值）
        // 计算7小时内的进度（0-1）
        const progress = (totalHours - 6) / 7
        dynamicShadowLength = BASE_SHADOW_LENGTH + (MAX_SHADOW_LENGTH - BASE_SHADOW_LENGTH) * progress
      } else if (totalHours >= 13 && totalHours < 19) {
        // 13点-19点：递减（从MAX到BASE，线性插值）
        // 计算6小时内的进度（0-1）
        const progress = (totalHours - 13) / 6
        dynamicShadowLength = MAX_SHADOW_LENGTH - (MAX_SHADOW_LENGTH - BASE_SHADOW_LENGTH) * progress
      }
      // 19点-6点：默认用BASE，保持不变

      // 3. 计算影子旋转角度
      const timeAngleDegree = totalHours * 15
      const timeAngleRadian = timeAngleDegree * (Math.PI / 180) // 转为弧度
      shadow.rotation.y = INITIAL_24H_ANGLE - timeAngleRadian

      // 4. 应用动态长度
      shadow.scale.x = dynamicShadowLength
    }


    // ---------------------- 窗口resize处理 ----------------------
    const handleResize = () => {
      if (!canvas.current) return
      const { clientWidth: width, clientHeight: height } = canvas.current!
      renderer.setSize(width, height, false)
      camera.aspect = 1
      camera.updateProjectionMatrix()
    }


    // ---------------------- 初始化组件 ----------------------
    createBox()
    const cylinderGroup = createCylinder()
    createGnomon(cylinderGroup)
    scene.add(riGuiGroup)

    // 初始化时更新影子（用当前时间）
    updateShadow(params.currentTimeStr)
    handleResize()

    // ---------------------- 渲染循环 ----------------------
    const render = () => {
      if (!canvas.current) return

      requestAnimationFrame(render)
      handleResize()
      updateShadow(params.targetPositionCurrentTimeStr) // 用目标时间实时更新

      // 刻度盘倾斜逻辑
      if (cylinderGroupRef.current) {
        const latitude = params.latitudePosition

        cylinderGroupRef.current.rotation.x = Math.abs(latitude) * (Math.PI / 180)

        cylinderGroupRef.current.position.y = boxHeight + 3 * Math.sin(cylinderGroupRef.current.rotation.x)
      }

      // 更新时间显示
      currentTimeSpanRef.current!.innerText = params.currentTimeStr
      targetTimeSpanRef.current!.innerText = params.targetPositionCurrentTimeStr

      renderer.render(scene, camera)
      controls.update()
    }
    requestAnimationFrame(render)


    // ---------------------- 清理函数 ----------------------
    return () => {
      window.removeEventListener('resize', handleResize)
      renderer.dispose()
      // 几何体与材质清理（避免内存泄漏）
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose()
          if (obj.material instanceof THREE.Material) {
            obj.material.dispose()
          }
        }
      })
    }
  }


  // ---------------------- React生命周期 ----------------------
  useEffect(() => {
    const clean = main()
    return clean
  }, [canvas.current, params.latitudePosition, params.currentTimeStr])


  // ---------------------- 渲染DOM ----------------------
  return (
    <div className='sundial-container' style={{ position: 'absolute', left: 0, bottom: 0 }}>
      <div style={{ color: '#fff', marginBottom: 8 }}>
        北京时间：<span ref={currentTimeSpanRef}>{params.currentTimeStr}</span>
        <br />
        目标时间：<span ref={targetTimeSpanRef}>{params.targetPositionCurrentTimeStr}</span>
      </div>
      <div style={{ width: 250, height: 250 }}>
        <canvas className="canvas-body" ref={canvas}></canvas>
      </div>
    </div>
  )
}

export default Sundial
