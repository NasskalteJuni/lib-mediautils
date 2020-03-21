/**
 * get a report of the inbound and outbound byte and packet transmission rate as also the packet-loss for this peer connection as an Object
 * @param {Number} [watchTime=1000] the time to gather the data transmission rates in milliseconds. Defaults to 1 Second, ergo 1000 ms.
 * @return Promise resolves with an performance report Object containing inbound and outbound dictionaries with the keys bytes, packets and packetLoss
 * */
module.exports = async function getReport(rtcPeerConnection, watchTime = 1000){
    const getRelevantValues = statValueDict => {
        const val = {inbound: {bytes: 0, packets: 0, packetLoss: 0}, outbound: {bytes: 0, packets: 0, packetLoss: 0}, timestamp: 0};
        for(let stat of statValueDict){
            if(stat.type === 'inbound-rtp'){
                val.inbound.bytes += stat.bytesReceived;
                val.inbound.packets += stat.packetsReceived;
                val.inbound.packetLoss += stat.packetsLost;
            }else if(stat.type === 'outbound-rtp'){
                val.outbound.bytes += stat.bytesSent;
                val.outbound.packets += stat.packetsSent;
            }else if(stat.type === 'remote-inbound-rtp'){
                val.outbound.packetLoss += stat.packetsLost;
            }else if(stat.type === 'peer-connection'){
                val.timestamp = stat.timestamp;
            }
        }
        return val;
    };
    return new Promise(async(resolve, reject) => {
        try{
            const statsAtStart = (await rtcPeerConnection.getStats()).values();
            setTimeout(async () => {
                const statsAtEnd = (await rtcPeerConnection.getStats()).values();
                const valuesAtStart = getRelevantValues(statsAtStart);
                const valuesAtEnd = getRelevantValues(statsAtEnd);
                const duration = valuesAtEnd.timestamp - valuesAtStart.timestamp;
                resolve({
                    inbound: {
                        bytes: valuesAtEnd.inbound.bytes-valuesAtStart.inbound.bytes,
                        packets: valuesAtEnd.inbound.packets-valuesAtStart.inbound.packets,
                        packetLoss: valuesAtEnd.inbound.packetLoss-valuesAtStart.inbound.packetLoss,
                        tracks: rtcPeerConnection.getTransceivers().filter(tr => tr.currentDirection !== "inactive" && (tr.direction === "sendrecv" || tr.direction === "recvonly") && tr.receiver.track && tr.receiver.track.readyState === "live").length
                    },
                    outbound: {
                        bytes: valuesAtEnd.outbound.bytes-valuesAtStart.outbound.bytes,
                        packets: valuesAtEnd.outbound.packets-valuesAtStart.outbound.packets,
                        packetLoss: valuesAtEnd.outbound.packetLoss-valuesAtStart.outbound.packetLoss,
                        tracks: rtcPeerConnection.getTransceivers().filter(tr => tr.currentDirection !== "inactive" && (tr.direction === "sendrecv" || tr.direction === "sendonly") && tr.sender.track && tr.sender.track.readyState === "live").length
                    },
                    duration,
                });
            }, watchTime);
        }catch(err){
            reject(err);
        }
    });

}