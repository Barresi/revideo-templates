import { makeProject } from '@revideo/core'
import TopBottomScene from '../scenes/TopBottomScene'
import './global.css'

export default makeProject({
  scenes: [TopBottomScene],
  settings: {
    shared: {
      size: { x: 1080, y: 1920 }
    }
  }
})
