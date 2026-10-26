
function LocationCard() {
  return (
    <div className="visual">
      <div className="visual-card">
        <div className="visual-top">
          <span className="live-dot"></span>
          LOCATION STATUS
        </div>

        <div className="map-circle">
          <div className="map-ring ring-one"></div>
          <div className="map-ring ring-two"></div>
          <div className="map-pin">●</div>
        </div>

        <h2>Location-aware attendance</h2>
        <p>Designed for verified check-ins</p>

        <div className="visual-bottom">
          <span>GPS</span>
          <span>PHOTO</span>
          <span>RECORD</span>
        </div>
      </div>
    </div>
  )
}

export default LocationCard
