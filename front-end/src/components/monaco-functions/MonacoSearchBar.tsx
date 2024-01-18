import { useState, useRef } from 'react';
import {
  IconButton,
  Dialog,
  DialogContent,
  Stack,
  Divider,
  Box,
  List,
  ListItemText,
  Typography,
  TextField,
  ListItemButton,
  Fab,
} from '@mui/material';
import { IconX } from '@tabler/icons-react';
import COMMANDS_JSON from 'src/utils/toolboxMonaco/toolboxMonaco';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCogs } from '@fortawesome/free-solid-svg-icons';
import PageContainer from 'src/components/container/PageContainer';

const SearchBar = () => {
  const [showDrawer, setShowDrawer] = useState(false);
  const [search, setSearch] = useState('');

  const handleDrawerClose = () => {
    setShowDrawer(false);
  };

  interface Command {
    kind: string;
    name: string;
    description: string;
    command: string;
  }
  
  interface Category {
    kind: string;
    name: string;
    contents: Command[];
  }

  const filterCommands = (commands: Category[], cSearch: string) => {
    if (commands.length > 1) {
      return commands.filter((category) => {
        return category.contents.filter((command) => {
          const lowerCSearch = cSearch.toLowerCase();
          const lowerName = command.name ? command.name.toLowerCase() : '';
          const lowerDescription = command.description ? command.description.toLowerCase() : '';
          const lowerCommand = command.command ? command.command.toLowerCase() : '';
  
          return (
            lowerName.includes(lowerCSearch) ||
            lowerDescription.includes(lowerCSearch) ||
            lowerCommand.includes(lowerCSearch)
          );
        }).length > 0;
      });
    }
  
    return commands;
  };
  
  const searchData = filterCommands(COMMANDS_JSON.contents, search);

  const copyButtonRef = useRef(null);

  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopy = (command: string) => {
    navigator.clipboard.writeText(command);
    setCopiedCommand(command);
    setCopySuccess(true);
    
    // Reset copySuccess after a certain duration
    setTimeout(() => {
      setCopySuccess(false);
    }, 2000);
  };

  return (
    <PageContainer>
      <Fab color="warning" aria-label="search" onClick={() => setShowDrawer(true)}>
        <FontAwesomeIcon
          icon={faCogs}
          size="1x"
          
        />
      </Fab>
      <Dialog
        open={showDrawer}
        onClose={handleDrawerClose}
        fullWidth
        maxWidth={'sm'}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
        PaperProps={{ sx: { position: 'fixed', top: 30, m: 0 } }}
      >
        <DialogContent className="testdialog">
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              id="tb-search"
              placeholder="Search here"
              fullWidth
              onChange={(e) => setSearch(e.target.value)}
              inputProps={{ 'aria-label': 'Search here' }}
            />
            <IconButton size="medium" onClick={handleDrawerClose}>
              <IconX size="18" />
            </IconButton>
          </Stack>
        </DialogContent>
        <Divider />
        <Box p={2} sx={{ maxHeight: '60vh', overflow: 'auto' }}>
          <Typography variant="h5" p={1}>
            Quick Command Links
          </Typography>
          <Box>
            <List component="nav">
              {searchData.map((category) => {
                return category.contents.map((command) => {
                  const isCopied = copiedCommand === command.command;
                  return (
                    <Box key={command.name}>
                      <ListItemButton
                        ref={copyButtonRef}
                        sx={{ py: 0.5, px: 1 }}
                        onClick={() => handleCopy(command.command)}
                        title='Click to copy'
                      >
                        <ListItemText
                          primary={command.command}
                          secondary={command.description}
                          sx={{ my: 0, py: 0.5, color: isCopied ? (copySuccess ? 'green' : 'inherit') : 'inherit' }}
                        />
                      </ListItemButton>
                    </Box>
                  );
                });
              })}
            </List>
          </Box>
        </Box>
      </Dialog>
    </PageContainer>
  );
};

export default SearchBar;
