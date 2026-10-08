/* Browser port of overlay/{aruco,road}_camera.py. Input is RGBA camera pixels. */
(function (root) {
  function detect(cv, pixels, width, height, mode, blackThreshold = 105) {
    const owned = [];
    const keep = value => { owned.push(value); return value; };
    try {
      const rgba = keep(cv.matFromArray(height, width, cv.CV_8UC4, pixels));
      const gray = keep(new cv.Mat());
      cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
      if (mode === 'aruco') {
        const dictionary = keep(cv.getPredefinedDictionary(cv.DICT_4X4_50));
        const parameters = keep(new cv.aruco_DetectorParameters());
        const refine = keep(new cv.aruco_RefineParameters(10, 3, true));
        const detector = keep(new cv.aruco_ArucoDetector(dictionary, parameters, refine));
        const corners = keep(new cv.MatVector()), ids = keep(new cv.Mat()), rejected = keep(new cv.MatVector());
        detector.detectMarkers(gray, corners, ids, rejected);
        const markers = [];
        for (let i = 0; i < ids.rows; i++) {
          const corner = corners.get(i);
          try {
            const p = Array.from(corner.data32F);
            const points = [0, 2, 4, 6].map(j => ({ x: p[j], y: p[j + 1] }));
            const x = points.reduce((sum, point) => sum + point.x, 0) / 4;
            const y = points.reduce((sum, point) => sum + point.y, 0) / 4;
            markers.push({ id: ids.data32S[i], corners: points, center_x: x, center_y: y,
              center_x_ratio: x / width, center_y_ratio: y / height,
              orientation_degrees: Math.atan2(p[3] - p[1], p[2] - p[0]) * 180 / Math.PI,
              frame_width: width, frame_height: height });
          } finally { corner.delete(); }
        }
        return { markers, road: null };
      }
      const roiTop = Math.round(height * 0.42), lookaheadY = Math.round(height * 0.78);
      const roi = keep(gray.roi(new cv.Rect(0, roiTop, width, height - roiTop)));
      const blurred = keep(new cv.Mat()), mask = keep(new cv.Mat());
      cv.GaussianBlur(roi, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
      const otsu = cv.threshold(blurred, mask, 0, 255, cv.THRESH_BINARY_INV | cv.THRESH_OTSU);
      const threshold = Math.max(25, Math.min(blackThreshold, Math.round(otsu)));
      cv.threshold(blurred, mask, threshold, 255, cv.THRESH_BINARY_INV);
      const open = keep(cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3)));
      const close = keep(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(7, 11)));
      cv.morphologyEx(mask, mask, cv.MORPH_OPEN, open);
      cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, close);
      const contours = keep(new cv.MatVector()), hierarchy = keep(new cv.Mat());
      cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      const candidates = [], roiHeight = height - roiTop;
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i), line = new cv.Mat();
        try {
          const area = cv.contourArea(contour), rect = cv.boundingRect(contour);
          if (area < width * height * 0.0025 || rect.height < roiHeight * 0.24 || rect.width > width * 0.28) continue;
          cv.fitLine(contour, line, cv.DIST_L2, 0, 0.01, 0.01);
          const [vx, vy, x0, localY] = line.data32F;
          if (Math.abs(vy) < 0.12) continue;
          const xAt = y => x0 + (y - localY - roiTop) * vx / vy;
          const x = xAt(lookaheadY);
          if (x < -width * 0.25 || x > width * 1.25) continue;
          candidates.push({ area, height: rect.height, x, x_ratio: x / width, top_x: xAt(roiTop), bottom_x: xAt(height - 1) });
        } finally { line.delete(); contour.delete(); }
      }
      let best = null;
      for (let i = 0; i < candidates.length; i++) for (let j = i + 1; j < candidates.length; j++) {
        const [left, right] = [candidates[i], candidates[j]].sort((a, b) => a.x - b.x);
        const separation = right.x - left.x, center = (left.x + right.x) / 2;
        if (separation < width * 0.16 || separation > width * 0.92) continue;
        const score = left.area + right.area + (left.height + right.height) * 4 - Math.abs(center / width - 0.5) * width * height * 0.02;
        if (!best || score > best.score) best = { score, left, right, separation, center };
      }
      if (!best) return { markers: [], road: null, effective_black_threshold: threshold };
      const { left, right, separation, center } = best;
      const boundary = b => ({ x: b.x, x_ratio: b.x_ratio, top_x: b.top_x, bottom_x: b.bottom_x });
      return { markers: [], effective_black_threshold: threshold, road: {
        detected: true, left: boundary(left), right: boundary(right), center_x: center,
        center_x_ratio: center / width, center_error: center / width - 0.5,
        lane_width: separation, lane_width_ratio: separation / width,
        lookahead_y: lookaheadY, lookahead_y_ratio: lookaheadY / height,
        confidence: Math.min(1, Math.max(0, 0.55 * Math.min(left.height, right.height) / roiHeight + 0.45 * Math.min(1, separation / (width * 0.45)))),
        frame_width: width, frame_height: height,
      } };
    } finally { owned.reverse().forEach(value => value.delete()); }
  }
  root.FossbotCameraDetection = { detect };
  if (typeof module !== 'undefined') module.exports = { detect };
})(typeof self !== 'undefined' ? self : globalThis);
