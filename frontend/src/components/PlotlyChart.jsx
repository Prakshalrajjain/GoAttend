import { useEffect, useRef } from 'react'
import Plotly from 'plotly.js-dist-min'

export default function PlotlyChart({ data, layout, config }) {
  const chartRef = useRef(null)

  useEffect(() => {
    if (!chartRef.current) return

    const defaultLayout = {
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: {
        family: 'Inter, Arial, sans-serif',
        color: '#dce8e4',
      },
      margin: { t: 40, r: 20, b: 40, l: 40 },
      ...layout,
    }

    const defaultConfig = {
      responsive: true,
      displayModeBar: false,
      ...config,
    }

    Plotly.newPlot(chartRef.current, data, defaultLayout, defaultConfig)

    const handleResize = () => {
      if (chartRef.current) {
        Plotly.Plots.resize(chartRef.current)
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (chartRef.current) {
        Plotly.purge(chartRef.current)
      }
    }
  }, [data, layout, config])

  return <div ref={chartRef} style={{ width: '100%', minHeight: '320px' }} />
}
