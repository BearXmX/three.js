# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      ...tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      ...tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      ...tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

```tsx
import React, { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'

type HauntdHousePropsType = {}

const HauntdHouse: React.FC<HauntdHousePropsType> = props => {
  const {} = props

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
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100)
    camera.position.set(0, 0, 20)
    camera.lookAt(0, 0, 0)

    /* 控制器 */
    const controls = new OrbitControls(camera, canvasRef.current)
    controls.enableDamping = true
    controls.target.set(0, 0, 0)
    controls.update()

    /* 世界坐标辅助器 */
    const axesHelper = new THREE.AxesHelper(5)
    scene.add(axesHelper)

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

export default HauntdHouse
```
