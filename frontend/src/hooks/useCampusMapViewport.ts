import { useEffect } from 'react';
import type { CampusSpot } from '../types';

declare const AMap: any;

export function useCampusMapViewport(
  mapInstance: React.MutableRefObject<any>,
  mapReady: boolean,
  spots: CampusSpot[],
  isActive: boolean
) {
  useEffect(() => {
    if (!mapReady || !mapInstance.current || !isActive || typeof AMap === 'undefined') return;
    
    // Default Shanhai University south gate
    const SHANHAI_CENTER = { lng: 119.5590, lat: 39.9326 };

    if (spots.length === 0) {
      mapInstance.current.setZoomAndCenter(16, [SHANHAI_CENTER.lng, SHANHAI_CENTER.lat]);
      return;
    }

    if (spots.length === 1) {
      mapInstance.current.setZoomAndCenter(17, [spots[0].longitude, spots[0].latitude]);
      return;
    }

    try {
      const markers = spots.map(spot => new AMap.Marker({
        position: [spot.longitude, spot.latitude]
      }));
      mapInstance.current.setFitView(markers, false, [60, 60, 60, 60], 17);
    } catch (e) {
      console.warn('Failed to set fit view, falling back to default center', e);
      mapInstance.current.setZoomAndCenter(16, [SHANHAI_CENTER.lng, SHANHAI_CENTER.lat]);
    }
  }, [mapInstance, mapReady, spots, isActive]);
}
