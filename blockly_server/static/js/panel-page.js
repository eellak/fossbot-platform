let parameters = new Object();
let parameters_array = [];

function languange_select(value)

{   
    
    document.cookie = 'locale='+value;
    window.location.reload();
    //alert(document.cookie);
}


function loadSettings(data) {
    console.log('Loading settings of the projects');

    parameters = data.parameters;
    console.log('parameters:', parameters);

    parameters_array = Object.values(parameters);
    keys_array = Object.keys(parameters);

    for (var i = 0; i < keys_array.length; i++) {
        const parameter_key = keys_array[i];
        const parameter = parameters_array[i];
        console.log('parameter:', parameter_key);
        

        if(parameter_key == "robot_name") {
            document.getElementById("body-table-parameters").insertRow(-1).innerHTML =
            '<tr>' +
            '<td>' + parameter['name'] + '</td>' +
            '<td>' + parameter['default'] + '</td>' +
            '<td>' + '<input type="text" id="' + i + '" value="' + parameter['value'] + '" name="' + parameter_key +  '">' + '</td>' +
            '</tr>';
        } else {
            document.getElementById("body-table-parameters").insertRow(-1).innerHTML =
            '<tr>' +
            '<td>' + parameter['name'] + '</td>' +
            '<td>' + parameter['default'] + '</td>' +
            '<td>' + '<input type="number" id="' + i + '" value="' + parameter['value'] + '" name="' + parameter_key + '">' + '</td>' +
            '</tr>';
        } 
    }
}

async function saveSettings() {
    let parameters_to_send = {};

    for (var i = 0; i < parameters_array.length; i++) {
        var value = document.getElementById(i).value;
        var par_name = document.getElementById(i).name;
        // parameters_to_send.push(value);
        parameters_to_send[par_name] = value;
    }


    console.log("parameters to send : ", parameters_to_send);
    const result = await sendParameters(JSON.stringify(parameters_to_send));

    if (result.status == 200) {
        window.location.replace('/');
    } else {
        const error_text = "Υπήρξε πρόβλημα κατά την αποθήκευση των ρυθμίσεων του ρομπότ. Οι ρυμθίσεις δεν αποθηκεύτηκαν!";
        showModalError(error_text);
    }
}
