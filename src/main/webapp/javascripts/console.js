function append(element, text) {
    if (!text) return;
    if (typeof(text) == 'object') text = JSON.stringify(text);
    text = highlight(text);
    element.html(element.html() + "\n" + text);
    element.prop("scrollTop", element.prop("scrollHeight") - element.height());
}

function highlight(text) {
    if (!text) return text;
	text = text.replace(/<null>/gi, '&lt;null&gt;');
    if (text[0] == "(" || text[0] == "[") {
        // Geoff
        // colour nodes
        text = text.replace(/(\([0-9A-Za-z_]*?\))/gi, '<span class="node">$1</span>');
        // colour rels
        text = text.replace(/((<?-)?\[[0-9A-Za-z_:\.]*?\](->?)?)/gi, '<span class="relationship">$1</span>');
    } else if (isCypher(text)) {
        // Cypher
        text = text.replace(/\b(start|with|create|delete|relate|skip|limit|order by|set|match|where|return)\b/gi, '\n$1');
        text = text.replace(/\b(start|with|create|delete|relate|skip|limit|distinct|desc|asc|as|order by|foreach|set|match|where|return)\b/gi, '<span class="keyword">$1</span>');
        text = text.replace(/\b(and|or|not|has|node)\b/gi, '<span class="keyword">$1</span>');
        text = text.replace(/\b(type|collect|sum|sqrt|round|max|min|nodes|count|length|avg|rels)\b\(/gi, '<span class="function">$1</span>(');
    }
    return text;
}

function post(uri, data, done, dataType) {
    data = data.trim();
    console.log("Post data: " + data);
    $.ajax(uri, {
        type:"POST",
        data:data,
        dataType: dataType || "text",
        success:function (data) {
            if (dataType=="text") append($("#output"), data);
            if (done) {
                done(data);
            }
        },
        error:function (data, error) {
            append($("#output"), "Error: "+error+"\n" + data.responseText+"");
        }
    });
}
function getParameters() {
    var pairs = window.location.search.substr(1).split('&');
    if (!pairs) return {};
    var result = {};
    for (var i = 0; i < pairs.length; ++i) {
        var pair = pairs[i].split('=');
        // console.log(pair);
        if (pair.length != 2) continue;
        result[pair[0]] = decodeURIComponent(pair[1].replace(/\+/g, " "));
    }
    return result;
}

function share(fn) {
    $.ajax("/console/url", { type:"GET", success:fn});
}

function isCypher(query) {
    return query && query.match(/\b(start|create|delete|relate)\b/i);
}
function viz(data) {
    if ($('#graph').is(":hidden")) return;
    var graph = $("#graph");
    graph.empty();
    if (data) {
        visualize("graph", graph.width(), graph.height(),data)
    } else {
        var query = $("#input").val();
        if (!isCypher(query)) query = "";
        render("graph", graph.width(), graph.height(), "/console/visualization?query=" + encodeURIComponent(query));
    }
    graph.show();
}
function reset(done) {
    $.ajax("/console", { type:"DELETE", success:done });
    return false;
}

function share_yuml(query) {
    if (!query) return;
    $.ajax("/console/to_yuml?query="+encodeURIComponent(query), {
        type: "GET", dataType: "text",
        success: function(data) {
            $('#share_yuml').attr("href",data);
    }});
}

function base_url() {
    return document.location.protocol + "//" + document.location.host;
}

function store_graph_info() {
    var init = $('#share_init').val();
    var query = $('#share_query').val();
    query = isCypher(query) ? query : null;
    var version = $('#share_version').val();
    var no_root = $("#share_no_root").is(":checked");
    var id = $('#share_short').val();
    if (id && (id.length==0 || id.match("http://.+"))) {
        id=null;
    }
    var message = null;
    // var uri = base_url()+'?init='+encodeURIComponent(init)+'&query='+encodeURIComponent(query)+'&version='+encodeURIComponent(version);
    // if (no_root) uri+="&no_root=true";

    $.ajax("/r/share", {
        type: "POST",
        dataType: "text",
        contentType: "application/json",
        data: JSON.stringify({
            id : id,
            init : init,
            query : query,
            version : version,
            no_root : no_root,
            message : message
        }),
        success: function(data) {
            var uri = (data.indexOf("http")!=0) ? base_url() + "/r/" + data : data;
            console.log(uri);
            var frame = '<iframe width="600" height="300" src="'+uri+'"/>';
            $('#share_iFrame').val(frame);
            $('#share_url').attr("href",uri);
            $('#share_short').val(uri);
            addthis.update('share', 'url', uri);
    }});
    share_yuml(query);
    addthis.update('share', 'title', 'Look at this #Neo4j graph: ');
}

function toggleGraph() {
    $('#graph').toggle();
    if ($('#graph').is(":visible")) {
        viz();
    }
}

function toggleShare() {
    $.ajax("console/to_cypher", {
        type:"GET",
        dataType: "text",
        success:function (data) {
            $('#share_init').val(data);
            var query = $("#input").val();
            query = isCypher(query) ? query : null;
            $('#share_query').val(query);
            $('#shareUrl').toggle();
            share_yuml(query)
        },
        error:function (data, error) {
            append($("#output"), "Error: "+error+"\n" + data.responseText+"");
        }
    });
}

function export_graph(format) {
    $.ajax("console/to_"+format, {
        type:"GET",
        dataType: "text",
        success:function (data) {
            $('#share_init').val(data);
        },
        error:function (data, error) {
            $('#share_init').val("Error: "+error+"\n" + data.responseText+"");
        }
    });
}

function showResults(data) {
    if (data["init"]) {
        append($("#output"), "Graph Setup:");
        append($("#output"), data["init"]);
	    append($("#output"), "--------------------------------------------------------------------------------");
    }
    if (data["query"]) {
	    append($("#output"), data["query"].trim());
        $("#input").val(data["query"]);
    }
    if (data["result"]) {
        append($("#output"), data["result"]);
//	    append($("#output"), "--------------------------------------------------------------------------------");
    }
    if (data["error"]) append($("#output"), "Error: " + data["error"]);
    if (data["visualization"]) {
        viz(data.visualization);
    }
}

function send(query) {
    if (isCypher(query)) {
        post("/console/cypher", query, showResults,"json");
    } else {
        post("/console/geoff", query, function () {
            viz();
        });
    }
}

function showVersion(json) {
    $('#version').val(json['version']);
    $('#share_version').val(json['version']);
}
function welcome_msg() {
    return $("#welcome_msg").html();
}

function showWelcome(json) {
    append( $( "#output" ), welcome_msg() );
    if (json['message']) {
        append( $( "#output" ), json['message'] );
    }
}

$(document).ready(function () {
    post( "/console/init", JSON.stringify( getParameters() ), function ( json )
    {
        showResults( json );
        showVersion( json );
        showWelcome( json )
    }, "json" );
    $('#version').change(function() { post("/console/version",$('#version').val(),showVersion,"json")});
    var input=$("#input");
    $("#form").submit(function () {
        send(input.val());
        return false;
    });
    var isInIFrame = window.location != window.parent.location;
    if (!isInIFrame) $("#input").focus();

    $("body").keyup(function(e) {
        if (e.keyCode == 27) $(".popup").hide();
		return true;
    });
/*
    input.keypress(function(e) {
        if (e.keyCode == 13) { // return, send
           e.preventDefault();
           e.stopPropagation();
           e.stopImmediatePropagation();
           e.cancelBubble = true;
           return false;
        }
        return true;
    });
    input.keyup(function(e) {
		 if (e.keyCode == 40) { // arrow down, add line
		 }
         if (e.keyCode == 13) { // return, send
            send(input.val());
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            e.cancelBubble = true;
            return false;
         }
         return true;
     });
*/
});