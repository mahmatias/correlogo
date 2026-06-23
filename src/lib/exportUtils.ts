import { TrainingSession } from '../types';

export const generateTCX = (session: TrainingSession): string => {
    const startTime = new Date(session.date).toISOString();
    let trackPoints = '';
    
    session.points.forEach(p => {
        let position = '';
        if (session.mode === 'outdoor' && p.lat !== undefined && p.lon !== undefined) {
            position = `<Position><LatitudeDegrees>${p.lat}</LatitudeDegrees><LongitudeDegrees>${p.lon}</LongitudeDegrees></Position>`;
        }
        trackPoints += `
          <Trackpoint>
            <Time>${new Date(new Date(session.date).getTime() + p.timestampSeconds * 1000).toISOString()}</Time>
            <DistanceMeters>${Math.round(p.distanceKm * 1000)}</DistanceMeters>
            ${position}
            <Extensions>
              <ns3:TPX>
                <ns3:Speed>${(p.speedKmh / 3.6).toFixed(2)}</ns3:Speed>
              </ns3:TPX>
            </Extensions>
          </Trackpoint>`;
    });

    return `<?xml version='1.0' encoding='UTF-8'?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2"
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Activities>
    <Activity Sport="Running">
      <Id>${startTime}</Id>
      <Notes>${session.mode === 'treadmill' ? 'Esteira' : 'Outdoor'}</Notes>
      <Lap StartTime="${startTime}">
        <TotalTimeSeconds>${session.totalDurationSeconds}</TotalTimeSeconds>
        <DistanceMeters>${(session.totalDistanceKm * 1000).toFixed(0)}</DistanceMeters>
        <Calories>0</Calories>
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>${trackPoints}
        </Track>
      </Lap>
      <Creator xsi:type="Device_t">
        <Name>Corre Logo</Name>
      </Creator>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;
};

export const generateGPX = (session: TrainingSession): string => {
    let trackPoints = '';
    
    session.points.forEach(p => {
        if (p.lat !== undefined && p.lon !== undefined) {
            trackPoints += `
      <trkpt lat="${p.lat}" lon="${p.lon}">
        <time>${new Date(new Date(session.date).getTime() + p.timestampSeconds * 1000).toISOString()}</time>
        <extensions>
          <ns3:TrackPointExtension>
            <ns3:speed>${(p.speedKmh / 3.6).toFixed(2)}</ns3:speed>
          </ns3:TrackPointExtension>
        </extensions>
      </trkpt>`;
        }
    });

    return `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<gpx xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:ns3="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd"
  creator="Corre Logo" version="1.1">
  <trk>
    <name><![CDATA[Corrida]]></name>
    <trkseg>${trackPoints}
    </trkseg>
  </trk>
</gpx>`;
};
