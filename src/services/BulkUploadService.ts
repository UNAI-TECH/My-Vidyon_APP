import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';

export interface BulkUploadRow {
    email: string;
    full_name: string;
    role: string;
    [key: string]: any;
}

export interface BulkUploadResult {
    email: string;
    password?: string;
    userId?: string; // Add this
    status: 'success' | 'error';
    message?: string;
}

export class BulkUploadService {
    /**
     * Parse an Excel or CSV file into an array of objects
     */
    static async parseExcel(file: File): Promise<any[]> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
                resolve(jsonData);
            };
            reader.onerror = (error) => reject(error);
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Generate password as Name + Year of Birth
     */
    static generatePassword(name: string, dob?: string): string {
        const cleanName = name.replace(/\s+/g, '').toLowerCase();
        let year = '2000';
        if (dob) {
            const date = new Date(dob);
            if (!isNaN(date.getFullYear())) {
                year = date.getFullYear().toString();
            } else if (dob.includes('-')) {
                year = dob.split('-')[0];
            } else if (dob.includes('/')) {
                year = dob.split('/').pop() || '2000';
            }
        }
        return `${cleanName}${year}`;
    }

    /**
     * Bulk create users via a Supabase Edge Function (Optimized with chunks)
     */
    static async bulkCreateUsers(users: BulkUploadRow[], institutionId: string, onProgress?: (current: number, total: number) => void): Promise<BulkUploadResult[]> {
        const results: BulkUploadResult[] = [];
        const CHUNK_SIZE = 5; // Process 5 users at a time
        const instId = institutionId;

        for (let i = 0; i < users.length; i += CHUNK_SIZE) {
            const chunk = users.slice(i, i + CHUNK_SIZE);
            const chunkPromises = chunk.map(async (user) => {
                const password = user.password || this.generatePassword(user.full_name || user.name, user.dob);
                try {
                    // 1. Create primary student/staff user
                    const { data, error } = await supabase.functions.invoke('create-user', {
                        body: {
                            email: user.email,
                            password: password,
                            role: (user.role && user.role.toLowerCase() === 'teacher') ? 'faculty' : user.role,
                            full_name: user.full_name || user.name,
                            institution_id: instId,
                            register_number: user.register_number,
                            staff_id: user.staff_id || user.staffId,
                            class_name: user.class_name || user.class,
                            section: user.section,
                            date_of_birth: user.dob || user.date_of_birth,
                            gender: user.gender,
                            parent_name: user.parent_name,
                            parent_email: user.parent_email,
                            parent_phone: user.parent_phone,
                            parent_contact: user.parent_contact || user.parent_phone,
                            address: user.address,
                            blood_group: user.blood_group || user.bloodGroup,
                            city: user.city,
                            zip_code: user.zip_code || user.zipCode,
                            academic_year: user.academic_year || user.academicYear,
                            phone: user.phone || user.contact || user.mobile
                        }
                    });

                    if (error) throw error;

                    const userId = data?.user?.id;

                    // 2. If student and parent details exist, provision parent
                    if (user.role === 'student' && user.parent_email && user.parent_name) {
                        try {
                            await supabase.functions.invoke('create-user', {
                                body: {
                                    email: user.parent_email,
                                    password: instId, // Default password for parents
                                    role: 'parent',
                                    full_name: user.parent_name,
                                    institution_id: instId,
                                    phone: user.parent_phone || user.parent_contact,
                                    student_id: userId // Link to child
                                }
                            });
                        } catch (parentErr) {
                            console.error(`Error provisioning parent ${user.parent_email} for student ${user.email}:`, parentErr);
                        }
                    }

                    return {
                        email: user.email,
                        password: password,
                        userId: userId,
                        status: 'success'
                    } as BulkUploadResult;
                } catch (error: any) {
                    console.error(`Error creating user ${user.email}:`, error);
                    return {
                        email: user.email,
                        status: 'error',
                        message: error.message
                    } as BulkUploadResult;
                }
            });

            const chunkResults = await Promise.all(chunkPromises);
            results.push(...chunkResults);

            if (onProgress) {
                onProgress(Math.min(i + CHUNK_SIZE, users.length), users.length);
            }
        }

        return results;
    }

    /**
     * Download results as an Excel file
     */
    static downloadResults(results: BulkUploadResult[], filename: string) {
        const worksheet = XLSX.utils.json_to_sheet(results);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Credentials");
        XLSX.writeFile(workbook, filename);
    }

    /**
     * Generate and download a template file
     */
    static generateTemplate(type: 'student' | 'staff' | 'parent') {
        let headers: any[] = [];
        let filename = '';

        if (type === 'student') {
            headers = [
                {
                    name: 'John Doe',
                    register_number: 'STU001',
                    class_name: 'Grade 10',
                    section: 'A',
                    dob: '2008-05-15',
                    gender: 'male',
                    parent_name: 'Richard Doe',
                    parent_email: 'richard.doe@example.com',
                    parent_phone: '1234567890',
                    email: 'john.doe@example.com',
                    address: '123 School St',
                    password: 'password123'
                },
                {
                    name: 'Sarah Smith',
                    register_number: 'STU002',
                    class_name: 'Grade 10',
                    section: 'B',
                    dob: '2008-06-20',
                    gender: 'female',
                    parent_name: 'Robert Smith',
                    parent_email: 'robert.smith@example.com',
                    parent_phone: '0987654321',
                    email: 'sarah.s@example.com',
                    address: '456 Education Ave',
                    password: 'password456'
                }
            ];
            filename = 'student-template.xlsx';
        } else if (type === 'staff') {
            headers = [
                {
                    name: 'Jane Smith',
                    staff_id: 'STAFF001',
                    email: 'jane.smith@example.com',
                    phone: '9876543210',
                    role: 'teacher',
                    subject_assigned: 'Mathematics',
                    class_assigned: '10',
                    section_assigned: 'A',
                    dob: '1985-10-20',
                    password: 'password123'
                },
                {
                    name: 'Mike Wilson',
                    staff_id: 'STAFF002',
                    email: 'mike.w@example.com',
                    phone: '1234567890',
                    role: 'admin',
                    subject_assigned: 'All',
                    class_assigned: 'N/A',
                    section_assigned: 'N/A',
                    dob: '1980-01-01',
                    password: 'password456'
                }
            ];
            filename = 'staff-template.xlsx';
        } else {
            headers = [
                {
                    full_name: 'Robert Smith',
                    email: 'robert.smith@example.com',
                    phone: '9876543210',
                    role: 'parent',
                    student_email: 'sarah.s@example.com', // Link to child via email
                    password: 'password123'
                },
                {
                    full_name: 'Richard Doe',
                    email: 'richard.doe@example.com',
                    phone: '1234567890',
                    role: 'parent',
                    student_email: 'john.doe@example.com',
                    password: 'password456'
                }
            ];
            filename = 'parent-template.xlsx';
        }

        const worksheet = XLSX.utils.json_to_sheet(headers);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
        XLSX.writeFile(workbook, filename);
    }
}
