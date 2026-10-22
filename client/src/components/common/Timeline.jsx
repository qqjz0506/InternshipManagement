import './Timeline.css'

// steps: [{ label, done, current }]
function Timeline({ steps }) {
  return (
    <div className="timeline">
      {steps.map((step, index) => (
        <div className="timeline-step" key={step.label}>
          <div className="timeline-marker">
            <div
              className={
                step.done
                  ? 'timeline-dot timeline-dot-done'
                  : step.current
                    ? 'timeline-dot timeline-dot-current'
                    : 'timeline-dot'
              }
            />
            {index < steps.length - 1 && <div className="timeline-line" />}
          </div>
          <div className="timeline-content">
            <div className={step.done || step.current ? 'timeline-label' : 'timeline-label timeline-label-pending'}>
              {step.label}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default Timeline
