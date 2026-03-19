let APP_ID = "39f32aaf6f764969b7d22f3d019e0087"

let token = null;
let uid = String(Math.floor(Math.random() * 10000))

let client;
let channel;

let queryString = window.location.search
let urlParams = new URLSearchParams(queryString)
const roomId = urlParams.get('room')
let displayName = urlParams.get('name') || 'Guest'

if(!roomId){
    window.location = 'lobby.html'
}

let localStream;
let peerConnections = {};
let memberNames = {};

const servers = {
    iceServers:[
        {
            urls:['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
        }
    ]
}


let constraints = {
    video:{
        width:{min:640, ideal:1920, max:1920},
        height:{min:480, ideal:1080, max:1080},
    },
    audio:true
}

let init = async () => {
    localStream = await navigator.mediaDevices.getUserMedia(constraints)
    document.getElementById('user-1').srcObject = localStream

    // Then try Agora
    client = await AgoraRTM.createInstance(APP_ID)
    await client.login({uid, token})

    channel = client.createChannel(roomId)
    await channel.join()

    channel.on('MemberJoined', handleUserJoined)
    channel.on('MemberLeft', handleUserLeft)

    client.on('MessageFromPeer', handleMessageFromPeer)
}
 

let handleUserLeft = (MemberId) => {
    if(peerConnections[MemberId]){
        peerConnections[MemberId].close()
        delete peerConnections[MemberId]
    }

    let videoPlayer = document.getElementById(`user-${MemberId}`)
    if(videoPlayer) videoPlayer.remove()
    updateGridLayout()
}

let handleMessageFromPeer = async (message, MemberId) => {

    message = JSON.parse(message.text)

    if(message.type === 'offer'){
        memberNames[MemberId] = message.name || 'Guest' 
        createAnswer(MemberId, message.offer)
    }

if(message.type === 'answer'){
    addAnswer(MemberId, message.answer)
}

   if(message.type === 'candidate'){
    if(peerConnections[MemberId]){
        peerConnections[MemberId].addIceCandidate(message.candidate)
    }
}
}

let handleUserJoined = async (MemberId) => {
    console.log('A new user joined the channel:', MemberId)
    createOffer(MemberId)
    updateGridLayout()
}


let createPeerConnection = async (MemberId) => {
    if(peerConnections[MemberId]) return

    let peerConnection = new RTCPeerConnection(servers)
    peerConnections[MemberId] = peerConnection

    let remoteStream = new MediaStream()
    let videoPlayer = document.createElement('video')
    videoPlayer.id = `user-${MemberId}`
    videoPlayer.autoplay = true
    videoPlayer.playsInline = true
    videoPlayer.srcObject = remoteStream
    document.getElementById('videos').appendChild(videoPlayer)

    let nameTag = document.createElement('div')
    nameTag.className = 'name-tag'
    nameTag.textContent = memberNames[MemberId] || 'Guest'
    document.getElementById('videos').appendChild(nameTag)

    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream)
    })

    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track)
        })
    }

    peerConnection.onicecandidate = async (event) => {
        if(event.candidate){
            client.sendMessageToPeer({text:JSON.stringify({'type':'candidate', 'candidate':event.candidate})}, MemberId)
        }
    }
}

let createOffer = async (MemberId) => {
    await createPeerConnection(MemberId)

    let offer = await peerConnections[MemberId].createOffer()
    await peerConnections[MemberId].setLocalDescription(offer)

    client.sendMessageToPeer({text:JSON.stringify({'type':'offer','offer':offer,'name':displayName})},MemberId)
}


let createAnswer = async (MemberId, offer) => {
    await createPeerConnection(MemberId)

    await peerConnections[MemberId].setRemoteDescription(offer)

    let answer = await peerConnections[MemberId].createAnswer()
    await peerConnections[MemberId].setLocalDescription(answer)

    client.sendMessageToPeer({text:JSON.stringify({'type':'answer', 'answer':answer})}, MemberId)
}


let addAnswer = async (MemberId, answer) => {
    if(!peerConnections[MemberId].currentRemoteDescription){
        peerConnections[MemberId].setRemoteDescription(answer)
    }
}
let updateGridLayout = () => {
    let videoContainer = document.getElementById('videos')
    let memberCount = Object.keys(peerConnections).length + 1

    videoContainer.className = ''

    if(memberCount === 2) videoContainer.classList.add('two-members')
    if(memberCount === 3) videoContainer.classList.add('three-members')
    if(memberCount === 4) videoContainer.classList.add('four-members')
    if(memberCount === 5) videoContainer.classList.add('five-members')
    if(memberCount === 6) videoContainer.classList.add('six-members')
}

let leaveChannel = async () => {
    await channel.leave()
    await client.logout()
}

let toggleCamera = async () => {
    let videoTrack = localStream.getTracks().find(track => track.kind === 'video')

    if(videoTrack.enabled){
        videoTrack.enabled = false
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(255, 80, 80)'
    }else{
        videoTrack.enabled = true
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)'
    }
}

let toggleMic = async () => {
    let audioTrack = localStream.getTracks().find(track => track.kind === 'audio')

    if(audioTrack.enabled){
        audioTrack.enabled = false
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(255, 80, 80)'
    }else{
        audioTrack.enabled = true
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(179, 102, 249, .9)'
    }
}
  
window.addEventListener('beforeunload', leaveChannel)

document.getElementById('camera-btn').addEventListener('click', toggleCamera)
document.getElementById('mic-btn').addEventListener('click', toggleMic)

init()