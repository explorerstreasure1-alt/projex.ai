// WebRTC Video Conferencing Module
class WebRTCMeeting {
  constructor() {
    this.localStream = null;
    this.remoteStreams = new Map();
    this.peerConnections = new Map();
    this.socket = null;
    this.roomId = null;
    this.userId = null;
    this.userName = null;

    // STUN servers (free public STUN servers)
    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };
  }

  async initialize(socket, roomId, userId, userName) {
    this.socket = socket;
    this.roomId = roomId;
    this.userId = userId;
    this.userName = userName;

    // Get user media
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      // Display local stream
      const localVideo = document.getElementById('localVideo');
      if (localVideo) {
        localVideo.srcObject = this.localStream;
      }

      return true;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      const msg = typeof translations !== 'undefined' && currentLanguage ? (translations[currentLanguage]['webrtc.media.access'] || 'Kamera ve mikrofon erişimi gerekiyor') : 'Kamera ve mikrofon erişimi gerekiyor';
      alert(msg);
      return false;
    }
  }

  createPeerConnection(targetSocketId) {
    const pc = new RTCPeerConnection(this.rtcConfig);

    // Add local stream tracks
    this.localStream.getTracks().forEach(track => {
      pc.addTrack(track, this.localStream);
    });

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('ice-candidate', {
          target: targetSocketId,
          candidate: event.candidate,
          caller: this.socket.id
        });
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      const remoteVideo = document.getElementById(`remoteVideo-${targetSocketId}`);
      if (remoteVideo) {
        remoteVideo.srcObject = event.streams[0];
      }
    };

    this.peerConnections.set(targetSocketId, pc);
    return pc;
  }

  async createOffer(targetSocketId) {
    const pc = this.createPeerConnection(targetSocketId);

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      this.socket.emit('offer', {
        target: targetSocketId,
        caller: this.socket.id,
        sdp: offer
      });
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }

  async handleOffer(data) {
    const pc = this.createPeerConnection(data.caller);

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.socket.emit('answer', {
        target: data.caller,
        caller: this.socket.id,
        sdp: answer
      });
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }

  async handleAnswer(data) {
    const pc = this.peerConnections.get(data.caller);
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    }
  }

  async handleIceCandidate(data) {
    const pc = this.peerConnections.get(data.caller);
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    }
  }

  async startScreenShare() {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      // Replace video track in all peer connections
      this.peerConnections.forEach((pc, socketId) => {
        const videoTrack = screenStream.getVideoTracks()[0];
        const sender = pc.getSenders().find(s => s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      });

      // Update local video
      const localVideo = document.getElementById('localVideo');
      if (localVideo) {
        localVideo.srcObject = screenStream;
      }

      this.socket.emit('start-screen-share', this.roomId);

      // Handle user stopping screen share
      screenStream.getVideoTracks()[0].onended = () => {
        this.stopScreenShare();
      };

      return screenStream;
    } catch (error) {
      console.error('Error starting screen share:', error);
      const msg = typeof translations !== 'undefined' && currentLanguage ? (translations[currentLanguage]['webrtc.screen.share.error'] || 'Ekran paylaşımı başlatılamadı') : 'Ekran paylaşımı başlatılamadı';
      alert(msg);
      return null;
    }
  }

  async stopScreenShare() {
    try {
      // Get back camera stream
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      // Replace video track in all peer connections
      this.peerConnections.forEach((pc, socketId) => {
        const videoTrack = cameraStream.getVideoTracks()[0];
        const sender = pc.getSenders().find(s => s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      });

      // Update local video
      const localVideo = document.getElementById('localVideo');
      if (localVideo) {
        localVideo.srcObject = cameraStream;
      }

      this.socket.emit('stop-screen-share', this.roomId);

      // Stop screen stream
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
      }

      this.localStream = cameraStream;
    } catch (error) {
      console.error('Error stopping screen share:', error);
    }
  }

  toggleAudio(enabled) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  toggleVideo(enabled) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  cleanup() {
    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }

    // Close all peer connections
    this.peerConnections.forEach(pc => {
      pc.close();
    });

    this.peerConnections.clear();
    this.remoteStreams.clear();

    if (this.socket) {
      this.socket.emit('leave-room', this.roomId);
    }
  }

  handleUserDisconnected(socketId) {
    const pc = this.peerConnections.get(socketId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(socketId);
    }

    // Remove remote video element
    const remoteVideo = document.getElementById(`remoteVideo-${socketId}`);
    if (remoteVideo) {
      remoteVideo.remove();
    }
  }
}

// Export for use in main application
window.WebRTCMeeting = WebRTCMeeting;
