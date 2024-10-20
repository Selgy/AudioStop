function getPlayheadPosition() {
    try {
        var sequence = app.project.activeSequence;
        if (sequence) {
            // Verify if getPlayerPosition() exists
            if (typeof sequence.getPlayerPosition === 'function') {
                var position = sequence.getPlayerPosition();
                if (position) {
                    var res = {
                        seconds: position.seconds,
                        ticks: position.ticks,
                        frameCount: position.frameCount
                    };
                    return JSON.stringify(res);
                } else {
                    return JSON.stringify({ error: "Position is undefined" });
                }
            } else {
                return JSON.stringify({ error: "getPlayerPosition() method not found on sequence." });
            }
        } else {
            return JSON.stringify({ error: "No active sequence found." });
        }
    } catch (e) {
        // ExtendScript does not have native JSON.stringify in older versions, ensure compatibility
        var errorObj = {
            error: e.toString(),
            fileName: e.fileName ? new File(e.fileName).fsName : "unknown",
            line: e.line || 0
        };
        return JSON.stringify(errorObj);
    }
}
