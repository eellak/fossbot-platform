 
import React from 'react';
import { Box, Typography, Button, Divider, Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {useAuth} from '../../authentication/AuthProvider';

import CustomTextField from '../../components/forms/theme-elements/CustomTextField';
import CustomFormLabel from '../../components/forms/theme-elements/CustomFormLabel';
import { registerType } from 'src/types/auth/auth';
import { useState } from 'react';

const AuthRegister = ({ title, subtitle, subtext }: registerType) => {
  const [username, setUsername] = useState(null);
  const [password, setPassword] = useState(null);
  const [firstname, setName] = useState(null);
  const [lasname, setLastname] = useState(null);
  const [email, setEmail] = useState(null);
  

  const handleUsernameChange = (event) => {
    setUsername(event.target.value);
  };

  const handlePasswordChange = (event) => {
    setPassword(event.target.value);
  };

  const handleNameChange = (event) => {
    setName(event.target.value);
  };

  const handleLastnameChange = (event) => {
    setLastname(event.target.value);
  };

  const handleEmailChange = (event) => {
    setEmail(event.target.value);
  };
  const auth = useAuth();
  const handleSubmit = async (event) => {
    event.preventDefault(); 
  
    try {
      // Call the Register function
      // await register(username, password, name, lasname, email);
      // navigate('/login');
      auth.registerAction({'username': username,
                                'password': password,
                                'firstname': firstname,
                                'lastname': lasname,
                                'email': email}); 
      return                                             
      
    } catch (error) {
      // Handle errors (e.g., show an error message to the user)
      console.error('Register error:', error);

    }
  };

  // const register = async (username, password, name, lasname, email) => {
  //   const response = await fetch('http://localhost:8000/register', {
  //     method: 'POST',
  //     headers: {
  //       'Content-Type': 'application/json',
  //     },
  //     body: JSON.stringify({ 'username': username,'password': password, 'firstname': firstname, 'lastname': lasname, 'email': email }),
  //   });
    
  //   const data = await response.json();
  //   console.log(data);
  // }

return(
  <>
    {title ? (
      <Typography fontWeight="700" variant="h3" mb={1}>
        {title}
      </Typography>
    ) : null}

    {subtext}
    {/* <AuthSocialButtons title="Sign up with" /> */}

    <Box mt={3}>
      <Divider>
        <Typography
          component="span"
          color="textSecondary"
          variant="h6"
          fontWeight="400"
          position="relative"
          px={2}
        >
          Sign up with
        </Typography>
      </Divider>
    </Box>

    <Box>
      <Stack mb={3}>
        <CustomFormLabel htmlFor="firstname" >Firstname</CustomFormLabel>
        <CustomTextField id="firstname" variant="outlined" fullWidth  onChange={handleNameChange}/>
        <CustomFormLabel htmlFor="lastname" >Lastname</CustomFormLabel>
        <CustomTextField id="lastname" variant="outlined" fullWidth onChange={handleLastnameChange} />
        <CustomFormLabel htmlFor="username" >Username</CustomFormLabel>
        <CustomTextField id="username" variant="outlined" fullWidth onChange={handleUsernameChange} />
  
        <CustomFormLabel htmlFor="email" >Email Adddress</CustomFormLabel>
        <CustomTextField id="email" variant="outlined" fullWidth  onChange={handleEmailChange}/>
        <CustomFormLabel htmlFor="password" >Password</CustomFormLabel>
        <CustomTextField id="password" variant="outlined" fullWidth onChange={handlePasswordChange}/>
      </Stack>
      <Button color="primary" variant="contained" size="large" fullWidth onClick={handleSubmit}
        type="submit">
        Sign Up
      </Button>
    </Box>
    {subtitle}
  </>
)};

export default AuthRegister;
