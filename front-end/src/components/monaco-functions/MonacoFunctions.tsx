import React, { useState, useEffect, useCallback } from 'react';
import COMMANDS_JSON from 'src/utils/toolboxMonaco/toolboxMonaco';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy } from '@fortawesome/free-solid-svg-icons';
import { IconChevronDown } from '@tabler/icons-react';
import DashboardCard from 'src/components/shared/DashboardCardWithChildren';
import {
    Divider,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Typography,
} from '@mui/material';

const FunctionsManual = () => {
    // Declare the data state variable
    const [data, setData] = useState([]);
    const [copiedCommand, setCopiedCommand] = useState(null);

    useEffect(() => {
        setData(COMMANDS_JSON.contents);
    }, []);

    const handleCopy = useCallback(async (command) => {
        try {
            await navigator.clipboard.writeText(command);
            console.log('Copying to clipboard was successful!');
            setCopiedCommand(command); // Set copiedCommand to the copied command
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    }, []);

    useEffect(() => {
        if (copiedCommand) {
            setTimeout(() => {
                setCopiedCommand(null);
            }, 1000); // Reset copiedCommand after one second
        }
    }, [copiedCommand]);

    return (
        <DashboardCard title="Robot Functions">
            {data && data.map((category, categoryIndex) => (
                <Accordion key={categoryIndex}>
                    <AccordionSummary
                        expandIcon={<IconChevronDown />}
                        aria-controls={`category${categoryIndex}-content`}
                        id={`category${categoryIndex}-header`}
                    >
                        <Typography variant="h5">{category.name}</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        {category.contents.map((item, itemIndex) => (
                            // Use a combination of categoryIndex and itemIndex for a unique key
                            <Accordion key={`${categoryIndex}-${itemIndex}`}>
                                <AccordionSummary
                                    expandIcon={<IconChevronDown />}
                                    aria-controls={`panel${itemIndex + 1}-content`}
                                    id={`panel${itemIndex + 1}-header`}
                                >
                                    <Typography variant="h6">{item.name}</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        {item.description}
                                    </Typography>
                                    <Typography variant="subtitle1" fontWeight="fontWeightBold">
                                        {item.command}
                                        <FontAwesomeIcon
                                            icon={faCopy}
                                            style={{ cursor: 'copy' }}
                                            onClick={() => handleCopy(item.command)}
                                        />
                                        {copiedCommand === item.command && <span>Copied!</span>}
                                    </Typography>
                                </AccordionDetails>
                            </Accordion>
                        ))}
                    </AccordionDetails>
                </Accordion>
            ))}
            <Divider />
        </DashboardCard>
    );
};

export default FunctionsManual;
