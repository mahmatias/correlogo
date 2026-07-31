import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons missing in Leaflet + Vite
// @ts-ignore
import icon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const layers = {
    light: {
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    },
    dark: {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    },
    satellite: {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    }
};

function MapBounds({ path }: { path: { lat: number; lng: number }[] }) {
    const map = useMap();
    useEffect(() => {
        map.invalidateSize();
        if (path.length > 0) {
            const bounds = L.latLngBounds(path.map(p => [p.lat, p.lng] as [number, number]));
            map.fitBounds(bounds, { padding: [20, 20] });
        }
    }, [path, map]);
    return null;
}

const getIsDark = () => !document.documentElement.classList.contains('light');

export default function MapComponent({ coords, path }: { coords: { lat: number; lng: number } | null, path: { lat: number; lng: number }[] }) {
    const [layerType, setLayerType] = useState<'light' | 'dark' | 'satellite'>(getIsDark() ? 'dark' : 'light');
    
    useEffect(() => {
        const observer = new MutationObserver(() => {
            setLayerType(getIsDark() ? 'dark' : 'light');
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    const layer = layers[layerType];

    return (
        <div className="w-full h-full rounded-xl overflow-hidden relative z-0">
            <div className="absolute top-2 right-2 z-[1000] flex flex-col gap-1">
                <button onClick={() => setLayerType('light')} className="bg-bg-surface text-xs p-2 rounded shadow">Claro</button>
                <button onClick={() => setLayerType('dark')} className="bg-bg-surface text-xs p-2 rounded shadow">Escuro</button>
                <button onClick={() => setLayerType('satellite')} className="bg-bg-surface text-xs p-2 rounded shadow">Satélite</button>
            </div>
            
            <MapContainer
                center={coords ? [coords.lat, coords.lng] : [-23.55, -46.63]}
                zoom={13}
                style={{ width: '100%', height: '100%' }}
            >
                <TileLayer
                    url={layer.url}
                    attribution={layer.attribution}
                />
                <Polyline positions={path.map(p => [p.lat, p.lng] as [number, number])} color={layerType === 'dark' ? '#FBC02D' : '#4285F4'} weight={4} />
                {coords && <Marker position={[coords.lat, coords.lng]} />}
                <MapBounds path={path} />
            </MapContainer>
        </div>
    );
}
