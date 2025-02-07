'use client';

import { useCallback, useState, useMemo, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import {
    Grid,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Box,
    Typography,
    Paper,
    CardActionArea,
    CardContent,
} from '@mui/material';
import { v4 as uuidv4 } from 'uuid';
import LoadingDots from '@/components/ui/LoadingDots';


interface Flashcard {
    id: string;
    front: string;
    back: string;
    selected: boolean;
}

export default function UploadPage() {
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const [filePreviews, setFilePreviews] = useState<string[]>([]);
    const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [flashcardsCreated, setFlashcardsCreated] = useState<boolean>(false);
    const [open, setOpen] = useState<boolean>(false);
    const [deckName, setDeckName] = useState<string>('');
    const [description, setDescription] = useState<string>('');
    const [decks, setDecks] = useState<any[]>([]);
    const [selectedDeck, setSelectedDeck] = useState<string>('');
    const [deckSaving, setDeckSaving] = useState<boolean>(false);
    const [saveMode, setSaveMode] = useState<boolean>(false);
    const [toSave, setToSave] = useState<boolean[]>([]);
    const [user, setUser] = useState<any | null>(null);
    const [flipped, setFlipped] = useState<boolean[]>([]);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const [isCardsLoading, setIsCardsLoading] = useState(false);

    useEffect(() => {
        const fetchUserDetails = async () => {
            try {
                const userResponse = await fetch('/api/user');

                if (userResponse.ok) {
                    const userData = await userResponse.json();
                    setUser(userData);
                } else {
                    setUser(null);
                }
            } catch (error: unknown) {
                setUser(null);
            }
        };

        fetchUserDetails();
    }, []);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        setFilePreviews([]);
        setError(null);
        setFlashcardsCreated(false);

        const validFiles = acceptedFiles.filter((file) => {
            if (file.size > MAX_FILE_SIZE) {
                setError(`File "${file.name}" is too large. Maximum file size is 10MB.`);
                return false;
            }
            return true;
        });

        if (validFiles.length === 0) return;

        setUploadedFiles(validFiles);
        setLoading(true);

        const newPreviews: string[] = [];
        validFiles.forEach((file) => {
            const reader = new FileReader();

            reader.onloadend = () => {
                const previewUrl = reader.result as string;
                newPreviews.push(previewUrl);
                setFilePreviews([...newPreviews]);
            };

            if (file.type === 'application/pdf' || file.type.startsWith('image/') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                reader.readAsDataURL(file);
            } else if (file.type === 'text/plain') {
                reader.readAsText(file);
                reader.onload = () => {
                    newPreviews.push(reader.result as string);
                    setFilePreviews([...newPreviews]);
                };
            }
        });

        setLoading(false);
    }, []);

    const handleCreateFlashcards = async () => {
        if (uploadedFiles.length > 0) {
            setLoading(true);
            const reader = new FileReader();

            reader.onloadend = async () => {
                const base64File = reader.result?.toString().split(',')[1];
                try {
                    // Step 1: Upload the file to extract text
                    const uploadResponse = await fetch('/api/upload', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            file: base64File,
                            fileType: uploadedFiles[0].type,
                        }),
                    });

                    if (!uploadResponse.ok) {
                        throw new Error('Error extracting text from the file.');
                    }

                    const { extractedText } = await uploadResponse.json();

                    // Step 2: Send the extracted text to generate flashcards
                    const generateResponse = await fetch('/api/generate/upload', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            text: extractedText,
                        }),
                    });

                    if (generateResponse.ok) {
                        const data = await generateResponse.json();
                        setFlashcards(data); // Store flashcards for display
                        setToSave(data.map(() => false)); // Set save selection state for each flashcard
                        setFlashcardsCreated(true);
                    } else {
                        throw new Error('Error generating flashcards.');
                    }
                } catch (err) {
                    console.error('Error:', err);
                    setError('Error generating flashcards.');
                } finally {
                    setLoading(false);
                }
            };

            reader.readAsDataURL(uploadedFiles[0]);
        }
    };


    const handleSaveMode = () => {
        setSaveMode(!saveMode);
    };

    const handleSelectCard = useCallback((index: any) => {
        setToSave((prev) => ({
            ...prev,
            [index]: !prev[index]
        }));
    }, []);


    const handleSelectAll = () => {
        setToSave(flashcards.map(() => true));
    };

    const handleSaveFlashcards = async (deckId: string) => {
        const selectedFlashcards = flashcards
            .filter((_, index) => toSave[index])
            .map((flashcard) => ({
                id: uuidv4(),
                user_id: user.id,
                front_text: flashcard.front,
                back_text: flashcard.back,
                deck_id: deckId,
                created_at: new Date().toISOString(),
            }));

        if (selectedFlashcards.length === 0) {
            alert('Please select the flashcards you want to save.');
            return;
        }

        try {
            const response = await fetch('/api/flashcard/batch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ flashcards: selectedFlashcards, userId: user.id }),

            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error(`Error: ${errorData.message}`);
            } else {
                setOpen(false);
                setFlashcards([]);
                setFlashcardsCreated(false);
                alert('Flashcards saved successfully!');
            }
        } catch (error) {
            console.error('Error saving flashcards:', error);
        }
    };

    const handleSaveToNewDeck = async () => {
        const deckId = uuidv4();
        const deckData = {
            id: deckId,
            user_id: user.id,
            name: deckName,
            description: description,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        try {
            const response = await fetch('/api/deck', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ deck: deckData }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error(`Error: ${errorData.message}`);
                return;
            }

            await handleSaveFlashcards(deckId);
        } catch (error) {
            console.error('Error saving deck:', error);
        }
    };

    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);
    const handleSetDeckSaving = () => setDeckSaving(!deckSaving);

    const { getRootProps, getInputProps } = useDropzone({ onDrop });

    const handleCardClick = useCallback((index: any) => {
        setActiveIndex(index);
        setFlipped((prev) => ({
            ...prev,
            [index]: !prev[index]
        }));
    }, []);

    const memoizedFlashcards = useMemo(() => {
        return flashcards.map((flashcard, index) => (
            <Grid item xs={12} sm={6} md={4} key={flashcard.id}>
                <CardActionArea
                    disableRipple
                    disableTouchRipple
                    onClick={() => {
                        if (saveMode) {
                            handleSelectCard(index);
                        } else {
                            handleCardClick(index);
                        }
                    }}
                    sx={{
                        background: 'none',
                        transition: 'transform 0.2s ease',
                        '&:hover': {
                            transform: 'scale(1.04)'
                        }
                    }}
                >
                    <CardContent
                        sx={{
                            borderRadius: '8px',
                            padding: 0
                        }}
                    >
                        <Box
                            sx={{
                                perspective: '1000px',
                                '& > div': {
                                    transition: 'transform 0.3s',
                                    transformStyle: 'preserve-3d',
                                    position: 'relative',
                                    width: '100%',
                                    height: '200px',
                                    borderRadius: '8px',
                                    transform: flipped[index]
                                        ? 'rotateX(180deg)'
                                        : 'rotateX(0deg)',
                                    background: flipped[index]
                                        ? 'linear-gradient(180deg, #FAFAFA, #91A4BC)'
                                        : 'linear-gradient(180deg, #91A4BC, #FAFAFA)'
                                },
                                '& > div > div': {
                                    position: 'absolute',
                                    width: '100%',
                                    height: '100%',
                                    backfaceVisibility: 'hidden',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    padding: 2,
                                    boxSizing: 'border-box',
                                    overflow: 'auto',
                                    borderRadius: '8px',
                                    background: flipped[index]
                                        ? 'linear-gradient(180deg, #FAFAFA, #91A4BC)'
                                        : 'linear-gradient(180deg, #91A4BC, #FAFAFA)'
                                },
                                '& > div > div:nth-of-type(2)': {
                                    transform: 'rotateX(180deg)'
                                }
                            }}
                        >
                            <div
                                style={{
                                    // border: `${toSave[index] ? '#718e4d' : '#3a6b8a'}`,
                                    border: `${toSave[index] ? '3px solid #050403' : 'none'}`
                                }}
                            >
                                <div>
                                    <Typography
                                        variant="h5"
                                        component="div"
                                        sx={{ fontSize: '22px' }}
                                    >
                                        {flashcard.front}
                                    </Typography>
                                </div>
                                <div>
                                    <Typography
                                        variant="h5"
                                        component="div"
                                        sx={{ fontSize: '22px' }}
                                    >
                                        {flashcard.back}
                                    </Typography>
                                </div>
                            </div>
                        </Box>
                    </CardContent>
                </CardActionArea>
            </Grid>
        ));
    }, [flashcards, activeIndex, saveMode, toSave, flipped]);

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4 mt-20">
            <div className="max-w-7xl w-full flex space-x-8">
                {/* Preview Section */}
                <div className="w-3/4 bg-white rounded-lg shadow-md p-6 border">
                    <h2 className="text-lg font-semibold text-gray-700 mb-4">File Preview</h2>
                    {filePreviews.length > 0 ? (
                        filePreviews.map((previewUrl, index) => (
                            <div key={index} className="mb-4">
                                {uploadedFiles[index].type === 'application/pdf' && (
                                    <iframe src={previewUrl} className="w-full h-96 border rounded" />
                                )}

                                {uploadedFiles[index].type.startsWith('image/') && (
                                    <img src={previewUrl} alt="Preview" className="w-full h-96 object-contain border rounded" />
                                )}

                                {uploadedFiles[index].type === 'text/plain' && (
                                    <pre className="w-full h-96 overflow-auto p-4 bg-gray-200 border rounded">{previewUrl}</pre>
                                )}
                            </div>
                        ))
                    ) : (
                        <p className="text-gray-500">No file selected for preview.</p>
                    )}
                </div>

                {/* Controls Section */}
                <div className="w-1/4 bg-white rounded-lg shadow-md p-6 border">
                    <div
                        {...getRootProps()}
                        className="border-2 border-dashed border-gray-300 p-10 rounded-lg cursor-pointer hover:border-blue-500 transition"
                    >
                        <input {...getInputProps()} />
                        <p className="text-gray-500 text-center">Drag & drop some files here, or click to select files</p>
                        <p className="text-sm text-center text-gray-400">Supported formats: .docx, .pdf, .txt, images. Max file size: 10MB</p>
                    </div>

                    {uploadedFiles.length > 0 && (
                        <div className="mt-6">
                            <h2 className="text-lg font-semibold text-gray-700 mb-4">Uploaded Files:</h2>
                            <ul className="list-disc list-inside text-gray-600">
                                {uploadedFiles.map((file, idx) => (
                                    <li key={idx} className="truncate">
                                        {file.name}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 text-red-500 text-center">
                            <p>{error}</p>
                        </div>
                    )}

                    <button
                        onClick={handleCreateFlashcards}
                        className="mt-6 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded w-full"
                        disabled={uploadedFiles.length === 0 || loading}
                    >
                        {loading ? <LoadingDots /> : 'Create Flashcards'}
                    </button>

                    {flashcardsCreated && (
                        <p className="mt-4 text-green-500 text-center">Flashcards created successfully!</p>
                    )}
                </div>
            </div>
            {flashcards.length > 0 ? (
                <Grid container spacing={3} mb={4} mt={10} width="1200px">
                    {memoizedFlashcards}
                </Grid>
            ) : (
                <Typography variant="h6" sx={{ mt: 4, color: 'textColor' }}>
                    No cards generated yet
                </Typography>
            )}
            {/* Flashcards Section */}
            {flashcardsCreated && (
                <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center'}}>
                    <Button
                        variant="contained"
                        onClick={handleSaveMode}
                        sx={{
                            fontFamily: 'Roboto, Arial, sans-serif',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            margin: 1,
                            marginBottom: 4,
                            borderRadius: '8px',
                            color: '#4A4A4A',
                            backgroundColor: `${saveMode ? '#B0AFAF' : '#D1CDCD'}`,
                            transition: 'background-color 0.3s ease',
                            '&:hover': {
                                backgroundColor: `${saveMode ? '#908E8E' : '#BEBBBB'}`
                            }
                        }}
                    >
                        Select
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleSelectAll}
                        sx={{
                            fontFamily: 'Roboto, Arial, sans-serif',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            margin: 1,
                            marginBottom: 4,
                            borderRadius: '8px',
                            color: '#4A4A4A',
                            backgroundColor: '#D1CDCD',
                            '&:hover': {
                                backgroundColor: '#BEBBBB'
                            }
                        }}
                    >
                        Select All
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleOpen}
                        sx={{
                            fontFamily: 'Roboto, Arial, sans-serif',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                            margin: 1,
                            marginBottom: 4,
                            borderRadius: '8px',
                            color: '#4A4A4A',
                            backgroundColor: '#B0C4DE',
                            '&:hover': {
                                backgroundColor: '#91A4BC'
                            }
                        }}
                    >
                        Save
                    </Button>
                </Box>
            )}

            {/* Save Flashcards Dialog */}
            <Dialog open={open} onClose={handleClose}>
                <DialogTitle>Save Flashcards</DialogTitle>
                <DialogContent>
                    {deckSaving ? (
                        <FormControl fullWidth>
                            <InputLabel>Select Deck</InputLabel>
                            <Select value={selectedDeck} onChange={(e) => setSelectedDeck(e.target.value)}>
                                {decks.map((deck) => (
                                    <MenuItem key={deck.id} value={deck.id}>
                                        {deck.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    ) : (
                        <Box>
                            <TextField
                                label="Deck Name"
                                fullWidth
                                margin="dense"
                                value={deckName}
                                onChange={(e) => setDeckName(e.target.value)}
                            />
                            <TextField
                                label="Description (Optional)"
                                fullWidth
                                multiline
                                rows={3}
                                margin="dense"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleSetDeckSaving}>
                        {deckSaving ? 'New Deck' : 'Save to Existing Deck'}
                    </Button>
                    <Button onClick={handleClose}>Cancel</Button>
                    <Button
                        onClick={() => {
                            if (deckSaving) {
                                handleSaveFlashcards(selectedDeck);
                            } else {
                                handleSaveToNewDeck();
                            }
                        }}
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
}
