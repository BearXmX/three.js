import React, { useEffect, useRef } from 'react'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import * as THREE from 'three'


type SundialPropsType = {
  params: {
    latitudePosition: number,
    longitudePosition: number
  }
}

const Sundial: React.FC<SundialPropsType> = (props) => {

  const canvas = useRef<HTMLCanvasElement>(null)

  const main = () => {
    // 渲染器
    const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas.current! })
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 相机
    const camera = new THREE.PerspectiveCamera(85, 1, 0.1, 300)

    camera.position.x = 0.2
    camera.position.y = 4
    camera.position.z = 10

    // 场景
    const scene = new THREE.Scene()

    // 添加世界坐标辅助器
    const axesHelper = new THREE.AxesHelper(2);

    scene.add(axesHelper);

    // 导入控制器
    const controls = new OrbitControls(camera, canvas.current)
    // 设置带阻尼的惯性
    controls.enableDamping = true
    // 设置阻尼系数

    const group = new THREE.Group()


    const boxHeight = 1
    const createBox = () => {

      const height = 1

      const texture = new THREE.TextureLoader().load(window.$$prefix + '/textures/concrete_floor_worn_001_diff_1k.jpg')

      const box = new THREE.Mesh(
        new THREE.BoxGeometry(8, height, 8),
        new THREE.MeshBasicMaterial({ color: '#b3b3b3', map: texture, side: THREE.DoubleSide, })
      )

      box.position.set(0, height / 2, 0)

      group.add(box)

      return box
    }

    const cylinderRadius = 3

    const createCylinder = () => {

      const height = 1; // 圆柱的厚度（水平方向的厚度）
      const cylinderGroup = new THREE.Group();

      // 创建圆柱（水平放置，绕X轴旋转90°）
      const cylinder = new THREE.Mesh(
        new THREE.CylinderGeometry(cylinderRadius, cylinderRadius, height, 32),
        new THREE.MeshBasicMaterial({
          color: '#a1a1a1',
          side: THREE.DoubleSide,
          wireframe: false // 可临时开启查看网格，辅助调试
        })
      );
      // 圆柱位置：Y轴为中心高度，Z轴居中（因为厚度沿Z轴）
      cylinder.position.set(0, cylinderRadius + boxHeight, 0);
      cylinder.rotation.x = Math.PI / 2; // 水平放置后，圆柱侧面在XY平面内
      cylinderGroup.add(cylinder);

      // 刻度线参数（适配水平圆柱）
      const markerLength = 0.5; // 向外延伸长度
      const markerThickness = 0.1; // 沿圆柱厚度方向（Z轴）的厚度
      const markerHeight = 0.2; // 沿圆柱高度方向（Y轴）的高度（贴合圆柱表面）
      const markerColor = 0x333333;

      // 绘制24根刻度线（每15°一根）
      for (let i = 0; i < 24; i++) {
        // 1. 计算角度（沿XY平面的圆周角度）
        const angle = (i * 15) * (Math.PI / 180); // 24小时均匀分布

        // 2. 计算刻度线在圆柱表面的位置（精准贴合圆柱侧面）
        // 水平圆柱的侧面在XY平面内，半径为cylinderRadius
        const x = Math.cos(angle) * cylinderRadius; // 圆周X坐标
        const y = Math.sin(angle) * cylinderRadius; // 圆周Y坐标（注意：这里用sin计算Y，因为在XY平面内）
        const z = 0; // 圆柱厚度中心（Z=0，与圆柱中心对齐）

        // 3. 创建刻度线几何体（方向适配水平圆柱）
        // 几何体尺寸：长度（径向）× 高度（Y轴）× 厚度（Z轴）
        const markerGeometry = new THREE.BoxGeometry(
          markerLength,    // 沿径向向外延伸
          markerHeight,    // 沿圆柱表面的高度方向（Y轴）
          markerThickness  // 沿圆柱厚度方向（Z轴）
        );
        const markerMaterial = new THREE.MeshBasicMaterial({ color: markerColor });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);

        // 4. 设置刻度线位置（从圆柱表面向外延伸）
        marker.position.set(
          x + Math.cos(angle) * (markerLength / 2), // X方向向外延伸一半
          y + Math.sin(angle) * (markerLength / 2), // Y方向向外延伸一半（关键：之前用了z，这里修正为y）
          z // 与圆柱厚度中心对齐，确保在圆柱平面上
        );

        // 5. 旋转刻度线，使其垂直贴合圆柱表面
        marker.rotation.z = angle; // 绕Z轴旋转，与圆周切线方向一致

        // 6. 添加到组
        cylinderGroup.add(marker);
      }

      // 将圆柱组添加到主场景
      group.add(cylinderGroup);

      return cylinderGroup;
    }

    const box = createBox()

    const cylinderGroup = createCylinder()

    scene.add(group)


    // 窗口大小调整
    const handleResize = () => {
      if (!canvas.current) return;
      const { clientWidth: width, clientHeight: height } = canvas.current;
      if (renderer.domElement.width !== width || renderer.domElement.height !== height) {
        renderer.setSize(width, height, false);
        camera.aspect = 1;
        camera.updateProjectionMatrix();
      }
    };

    function render(time: number) {
      if (!canvas.current) return;

      handleResize()

      const seconds = time * 0.001; // 将毫秒转换为秒


      const params = props.params

      cylinderGroup.rotation.x = (Math.PI / 180) * (90 - (Math.abs(params.latitudePosition) === 90 ? 0 : Math.abs(params.latitudePosition)))

      cylinderGroup.position.y = boxHeight + cylinderRadius * Math.sin(cylinderGroup.rotation.x)

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

  return <div className='sundial-container' style={{ position: 'absolute', left: 0, bottom: 0, width: 300, height: 300 }}>
    <canvas className="canvas-body" ref={canvas}></canvas>

  </div>

}

export default Sundial